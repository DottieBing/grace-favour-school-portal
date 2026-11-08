import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { LEVELS } from "@/lib/academic/levels";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  classId: z.uuid(),
  destinationClassId: z.uuid().nullable(),
  decisions: z
    .array(
      z.object({
        studentId: z.uuid(),
        action: z.enum(["promote", "repeat", "graduate"]),
      }),
    )
    .min(1, "Choose at least one student.")
    .max(300),
});

// About 100 years. Supabase has no permanent ban.
const BAN_DURATION = "876000h";
const FINAL_LEVEL = LEVELS[LEVELS.length - 1].number;

export async function POST(request: Request) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) return accessErrorResponse(access);

  let input: z.infer<typeof schema>;

  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ids = input.decisions.map((item) => item.studentId);

  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "A student was sent twice." }, { status: 400 });
  }

  const admin = createAdminClient();

  const source = await admin
    .from("classes")
    .select("id, level_number")
    .eq("id", input.classId)
    .maybeSingle();

  if (source.error) {
    console.error("Unable to load the class:", source.error.message);
    return NextResponse.json({ error: "Unable to run the promotion." }, { status: 500 });
  }

  if (!source.data) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const level = source.data.level_number as number;
  const wantsPromote = input.decisions.some((item) => item.action === "promote");
  const wantsGraduate = input.decisions.some((item) => item.action === "graduate");

  if (wantsGraduate && level !== FINAL_LEVEL) {
    return NextResponse.json(
      { error: "Only the final class can graduate students." },
      { status: 400 },
    );
  }

  if (wantsPromote) {
    if (!input.destinationClassId) {
      return NextResponse.json({ error: "Choose the class they move up to." }, { status: 400 });
    }

    const destination = await admin
      .from("classes")
      .select("id, is_active, level_number")
      .eq("id", input.destinationClassId)
      .maybeSingle();

    if (destination.error) {
      console.error("Unable to load the destination:", destination.error.message);
      return NextResponse.json({ error: "Unable to run the promotion." }, { status: 500 });
    }

    if (
      !destination.data ||
      !destination.data.is_active ||
      destination.data.level_number !== level + 1
    ) {
      return NextResponse.json(
        { error: "Choose an active class exactly one level up." },
        { status: 400 },
      );
    }
  }

  const students = await admin
    .from("students")
    .select("id, user_id")
    .in("id", ids)
    .eq("current_class_id", input.classId)
    .eq("status", "active");

  if (students.error) {
    console.error("Unable to load students:", students.error.message);
    return NextResponse.json({ error: "Unable to run the promotion." }, { status: 500 });
  }

  if ((students.data ?? []).length !== ids.length) {
    return NextResponse.json(
      { error: "The class has changed. Refresh the page and try again." },
      { status: 409 },
    );
  }

  const session = await getCurrentSession();
  const now = new Date().toISOString();
  const done: { studentId: string; to: string | null; action: string }[] = [];
  const failed: string[] = [];

  const promoteIds = input.decisions
    .filter((item) => item.action === "promote")
    .map((item) => item.studentId);

  if (promoteIds.length > 0) {
    const { error } = await admin
      .from("students")
      .update({ current_class_id: input.destinationClassId, updated_at: now })
      .in("id", promoteIds)
      .eq("current_class_id", input.classId)
      .eq("status", "active");

    if (error) {
      console.error("Promoting students failed:", error.message);
      return NextResponse.json(
        { error: "Unable to move the students up. Nothing was changed." },
        { status: 500 },
      );
    }

    for (const studentId of promoteIds) {
      done.push({ studentId, to: input.destinationClassId, action: "promote" });
    }
  }

  for (const item of input.decisions.filter((entry) => entry.action === "repeat")) {
    done.push({ studentId: item.studentId, to: input.classId, action: "repeat" });
  }

  const userById = new Map(
    (students.data ?? []).map((item) => [item.id as string, item.user_id as string | null]),
  );

  for (const item of input.decisions.filter((entry) => entry.action === "graduate")) {
    const update = await admin
      .from("students")
      .update({ status: "graduated", updated_at: now })
      .eq("id", item.studentId);

    if (update.error) {
      console.error("Graduating a student failed:", update.error.message);
      failed.push(item.studentId);
      continue;
    }

    const userId = userById.get(item.studentId);

    if (userId) {
      const ban = await admin.auth.admin.updateUserById(userId, {
        ban_duration: BAN_DURATION,
      });

      if (ban.error) {
        console.error("Blocking the login failed:", ban.error.message);
        await admin.from("students").update({ status: "active" }).eq("id", item.studentId);
        failed.push(item.studentId);
        continue;
      }
    }

    done.push({ studentId: item.studentId, to: null, action: "graduate" });
  }

  if (done.length > 0) {
    const { error } = await admin.from("student_promotions").insert(
      done.map((item) => ({
        student_id: item.studentId,
        from_class_id: input.classId,
        to_class_id: item.to,
        action: item.action,
        session_id: session?.id ?? null,
        actor_id: access.user.id,
      })),
    );

    if (error) console.error("Saving promotion history failed:", error.message);
  }

  return NextResponse.json({
    promoted: done.filter((item) => item.action === "promote").length,
    stayed: done.filter((item) => item.action === "repeat").length,
    graduated: done.filter((item) => item.action === "graduate").length,
    failed: failed.length,
  });
}
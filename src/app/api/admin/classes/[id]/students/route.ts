import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  studentIds: z.array(z.uuid()).min(1, "Choose at least one student.").max(200),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) return accessErrorResponse(access);

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let ids: string[];

  try {
    ids = [...new Set(schema.parse(await request.json()).studentIds)];
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const cls = await admin
    .from("classes")
    .select("id, is_active, capacity")
    .eq("id", id)
    .maybeSingle();

  if (cls.error) {
    console.error("Unable to load class:", cls.error.message);
    return NextResponse.json({ error: "Unable to move the students." }, { status: 500 });
  }

  if (!cls.data || !cls.data.is_active) {
    return NextResponse.json({ error: "Choose an active class." }, { status: 400 });
  }

  const found = await admin
    .from("students")
    .select("id, current_class_id")
    .in("id", ids)
    .eq("status", "active");

  if (found.error) {
    console.error("Unable to load students:", found.error.message);
    return NextResponse.json({ error: "Unable to move the students." }, { status: 500 });
  }

  if ((found.data ?? []).length !== ids.length) {
    return NextResponse.json(
      { error: "Some students are no longer active. Refresh the page and try again." },
      { status: 409 },
    );
  }

  const toMove = (found.data ?? [])
    .filter((item) => item.current_class_id !== id)
    .map((item) => item.id as string);

  if (toMove.length === 0) {
    return NextResponse.json(
      { error: "Those students are already in this class." },
      { status: 409 },
    );
  }

  const count = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("current_class_id", id)
    .eq("status", "active");

  if (count.error) {
    console.error("Unable to count students:", count.error.message);
    return NextResponse.json({ error: "Unable to move the students." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("students")
    .update({ current_class_id: id, updated_at: new Date().toISOString() })
    .in("id", toMove)
    .eq("status", "active")
    .select("id");

  if (error) {
    console.error("Moving students failed:", error.message);
    return NextResponse.json({ error: "Unable to move the students." }, { status: 500 });
  }

  const capacity = (cls.data.capacity as number | null) ?? null;
  const total = (count.count ?? 0) + (data ?? []).length;

  return NextResponse.json({
    moved: (data ?? []).length,
    overCapacity: capacity !== null && total > capacity,
  });
}
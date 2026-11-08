import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { loadActiveComponents } from "@/lib/results/components";
import { getTeacherScope } from "@/lib/results/scope";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  classId: z.uuid(),
  subjectIds: z.array(z.uuid()).min(1, "Choose at least one subject.").max(40),
});

type Outcome = {
  subjectId: string;
  status: "submitted" | "incomplete" | "locked" | "failed";
  message?: string;
};

export async function POST(request: Request) {
  const access = await getAccess("teacher");

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

  const admin = createAdminClient();
  const found = await getTeacherScope(admin, access.user.id, input.classId);

  if (!found.ok) {
    return NextResponse.json({ error: found.message }, { status: found.status });
  }

  const subjectIds = [...new Set(input.subjectIds)];

  if (subjectIds.some((id) => !found.scope.subjectIds.includes(id))) {
    return NextResponse.json({ error: "You can't submit one of those subjects." }, { status: 403 });
  }

  const [rosterResult, components] = await Promise.all([
    admin
      .from("students")
      .select("id")
      .eq("current_class_id", input.classId)
      .eq("status", "active")
      .limit(1000),
    loadActiveComponents(admin),
  ]);

  if (rosterResult.error || !components) {
    console.error("Unable to verify the class:", rosterResult.error?.message ?? "components");
    return NextResponse.json({ error: "Unable to submit the results." }, { status: 500 });
  }

  const roster = (rosterResult.data ?? []).map((item) => item.id as string);

  if (roster.length === 0 || components.length === 0) {
    return NextResponse.json(
      { error: "There are no students or score components to submit." },
      { status: 409 },
    );
  }

  const componentList = components.map((item) => ({ id: item.id, name: item.name, max: item.max }));
  const results: Outcome[] = [];

  for (const subjectId of subjectIds) {
    const sheet = await admin
      .from("result_sheets")
      .select("id, status")
      .eq("class_id", input.classId)
      .eq("subject_id", subjectId)
      .eq("term_id", found.termId)
      .maybeSingle();

    if (sheet.error) {
      console.error("Unable to load the sheet:", sheet.error.message);
      results.push({ subjectId, status: "failed", message: "Couldn't check this subject." });
      continue;
    }

    if (!sheet.data) {
      results.push({ subjectId, status: "incomplete", message: "No scores entered yet." });
      continue;
    }

    if (sheet.data.status !== "draft") {
      results.push({ subjectId, status: "locked", message: "Already submitted." });
      continue;
    }

    const have = new Set<string>();

    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("result_scores")
        .select("student_id, component_id")
        .eq("sheet_id", sheet.data.id as string)
        .order("id", { ascending: true })
        .range(from, from + 999);

      if (error) {
        console.error("Unable to load scores:", error.message);
        results.push({ subjectId, status: "failed", message: "Couldn't check the scores." });
        break;
      }

      for (const row of data ?? []) have.add(`${row.student_id}:${row.component_id}`);

      if ((data ?? []).length < 1000) break;
    }

    if (results.some((item) => item.subjectId === subjectId)) continue;

    let missing = 0;

    for (const studentId of roster) {
      for (const component of components) {
        if (!have.has(`${studentId}:${component.id}`)) missing += 1;
      }
    }

    if (missing > 0) {
      results.push({
        subjectId,
        status: "incomplete",
        message: `${missing} score${missing === 1 ? " is" : "s are"} still empty.`,
      });
      continue;
    }

    const { error } = await admin.rpc("save_result_scores", {
      p_class_id: input.classId,
      p_subject_id: subjectId,
      p_term_id: found.termId,
      p_actor: access.user.id,
      p_scores: [],
      p_submit: true,
      p_components: componentList,
    });

    if (error) {
      if (error.code === "RS001") {
        results.push({ subjectId, status: "locked", message: "Already submitted." });
      } else {
        console.error("Submitting failed:", error.message);
        results.push({ subjectId, status: "failed", message: "Couldn't submit." });
      }

      continue;
    }

    results.push({ subjectId, status: "submitted" });
  }

  return NextResponse.json({ results });
}
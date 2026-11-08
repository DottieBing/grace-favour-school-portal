import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { loadActiveComponents } from "@/lib/results/components";
import { getTeacherScope } from "@/lib/results/scope";
import { scoreValue } from "@/lib/results/score-value";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  classId: z.uuid(),
  studentId: z.uuid(),
  scores: z
    .array(
      z.object({
        subjectId: z.uuid(),
        componentId: z.uuid(),
        score: scoreValue.nullable(),
      }),
    )
    .min(1, "There are no scores to save.")
    .max(400),
});

export async function POST(request: Request) {
  const access = await getAccess("teacher");

  if (!access.ok) return accessErrorResponse(access);

  let input: z.infer<typeof schema>;

  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid scores.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const found = await getTeacherScope(admin, access.user.id, input.classId);

  if (!found.ok) {
    return NextResponse.json({ error: found.message }, { status: found.status });
  }

  const subjectIds = [...new Set(input.scores.map((item) => item.subjectId))];

  if (subjectIds.some((id) => !found.scope.subjectIds.includes(id))) {
    return NextResponse.json(
      { error: "You can't score one of those subjects." },
      { status: 403 },
    );
  }

  const [studentResult, sheetsResult, components] = await Promise.all([
    admin
      .from("students")
      .select("id")
      .eq("id", input.studentId)
      .eq("current_class_id", input.classId)
      .eq("status", "active")
      .maybeSingle(),
    admin
      .from("result_sheets")
      .select("subject_id, status")
      .eq("class_id", input.classId)
      .eq("term_id", found.termId)
      .in("subject_id", subjectIds),
    loadActiveComponents(admin),
  ]);

  if (studentResult.error || sheetsResult.error || !components) {
    console.error(
      "Unable to verify the scores:",
      studentResult.error?.message ?? sheetsResult.error?.message ?? "components",
    );
    return NextResponse.json({ error: "Unable to save the scores." }, { status: 500 });
  }

  if (!studentResult.data) {
    return NextResponse.json({ error: "That student isn't in this class." }, { status: 404 });
  }

  if ((sheetsResult.data ?? []).some((item) => item.status !== "draft")) {
    return NextResponse.json(
      { error: "One of those subjects is already submitted. Refresh the page." },
      { status: 409 },
    );
  }

  const maxById = new Map(components.map((item) => [item.id, item.max]));
  const seen = new Set<string>();

  for (const item of input.scores) {
    const key = `${item.subjectId}:${item.componentId}`;
    const max = maxById.get(item.componentId);

    if (seen.has(key)) {
      return NextResponse.json({ error: "A score was sent twice. Refresh and try again." }, { status: 400 });
    }

    seen.add(key);

    if (max === undefined) {
      return NextResponse.json(
        { error: "The score components have changed. Refresh the page." },
        { status: 409 },
      );
    }

    if (item.score !== null && item.score > max) {
      return NextResponse.json({ error: "A score is higher than its maximum." }, { status: 400 });
    }
  }

  const componentList = components.map((item) => ({ id: item.id, name: item.name, max: item.max }));

  for (const subjectId of subjectIds) {
    const { error } = await admin.rpc("save_result_scores", {
      p_class_id: input.classId,
      p_subject_id: subjectId,
      p_term_id: found.termId,
      p_actor: access.user.id,
      p_scores: input.scores
        .filter((item) => item.subjectId === subjectId)
        .map((item) => ({
          student_id: input.studentId,
          component_id: item.componentId,
          score: item.score,
        })),
      p_submit: false,
      p_components: componentList,
    });

    if (error) {
      if (error.code === "RS001") {
        return NextResponse.json(
          { error: "A subject was submitted while you worked. Refresh the page. Earlier subjects were saved." },
          { status: 409 },
        );
      }

      console.error("Saving scores failed:", error.message);
      return NextResponse.json(
        { error: "Some scores may not have saved. Try again." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Saved." });
}
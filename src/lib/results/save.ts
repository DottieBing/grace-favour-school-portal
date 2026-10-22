import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadActiveComponents } from "@/lib/results/components";
import type { ScoreInput } from "@/lib/results/schema";
import { scoreKey } from "@/lib/results/types";

type Admin = ReturnType<typeof createAdminClient>;

export type SaveOutcome =
  | { ok: true }
  | { ok: false; status: number; message: string };

function fail(status: number, message: string): SaveOutcome {
  return { ok: false, status, message };
}

export async function saveSheet(
  admin: Admin,
  args: {
    classId: string;
    subjectId: string;
    termId: string;
    actorId: string;
    submit: boolean;
    scores: ScoreInput[];
  },
): Promise<SaveOutcome> {
  const components = await loadActiveComponents(admin);

  if (!components) {
    return fail(500, "Unable to load the score components.");
  }

  if (components.length === 0) {
    return fail(
      409,
      "No score components are set up yet. Contact the administrator.",
    );
  }

  const { data: roster, error: rosterError } = await admin
    .from("students")
    .select("id")
    .eq("current_class_id", args.classId)
    .eq("status", "active");

  if (rosterError) {
    console.error("Unable to load the class list:", rosterError.message);
    return fail(500, "Unable to load the class list.");
  }

  const rosterIds = new Set((roster ?? []).map((item) => item.id as string));

  if (rosterIds.size === 0) {
    return fail(400, "There are no active students in this class.");
  }

  const maxById = new Map(components.map((item) => [item.id, item.max]));
  const seen = new Set<string>();

  for (const score of args.scores) {
    const key = scoreKey(score.studentId, score.componentId);

    if (seen.has(key)) {
      return fail(400, "A score was sent twice. Refresh the page and try again.");
    }

    seen.add(key);

    const max = maxById.get(score.componentId);

    if (!rosterIds.has(score.studentId) || max === undefined) {
      return fail(
        409,
        "The class list or score components have changed. Refresh the page and try again.",
      );
    }

    if (score.score !== null && score.score > max) {
      return fail(400, "A score is higher than its maximum.");
    }
  }

  if (args.submit) {
    for (const studentId of rosterIds) {
      for (const component of components) {
        const entry = args.scores.find(
          (item) =>
            item.studentId === studentId && item.componentId === component.id,
        );

        if (!entry || entry.score === null) {
          return fail(
            400,
            "Enter every score before submitting. Use 0 where a student scored nothing.",
          );
        }
      }
    }
  }

  const { error } = await admin.rpc("save_result_scores", {
    p_class_id: args.classId,
    p_subject_id: args.subjectId,
    p_term_id: args.termId,
    p_actor: args.actorId,
    p_scores: args.scores.map((item) => ({
      student_id: item.studentId,
      component_id: item.componentId,
      score: item.score,
    })),
    p_submit: args.submit,
    p_components: components.map((item) => ({
      id: item.id,
      name: item.name,
      max: item.max,
    })),
  });

  if (error) {
    if (error.code === "RS001") {
      return fail(
        409,
        "These results have already been submitted. Ask the administrator to reopen them.",
      );
    }

    console.error("Saving results failed:", error.message);
    return fail(500, "Unable to save the results.");
  }

  return { ok: true };
}
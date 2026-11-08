import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadActiveComponents } from "@/lib/results/components";
import { gk, sk, type ClassScoring, type ScoringSubject } from "@/lib/results/scoring-types";
import type { GradeInfo, ScoreComponent, SheetState } from "@/lib/results/types";

type Admin = ReturnType<typeof createAdminClient>;

/** A class's students, the subjects given, and every score entered so far. */
export async function loadClassScoring(
  admin: Admin,
  args: { classId: string; termId: string; subjectIds: string[] },
): Promise<ClassScoring | null> {
  const rosterResult = await admin
    .from("students")
    .select("id, admission_number, first_name, middle_name, last_name")
    .eq("current_class_id", args.classId)
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(1000);

  if (rosterResult.error) {
    console.error("Unable to load the class list:", rosterResult.error.message);
    return null;
  }

  const students = (rosterResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
    admissionNumber: row.admission_number as string,
  }));

  if (args.subjectIds.length === 0) {
    return { students, subjects: [], scores: {}, grades: {} };
  }

  const [subjectsResult, sheetsResult, active] = await Promise.all([
    admin.from("subjects").select("id, name").in("id", args.subjectIds),
    admin
      .from("result_sheets")
      .select("id, subject_id, status, components")
      .eq("class_id", args.classId)
      .eq("term_id", args.termId)
      .in("subject_id", args.subjectIds),
    loadActiveComponents(admin),
  ]);

  if (subjectsResult.error || sheetsResult.error || !active) {
    console.error(
      "Unable to load scoring data:",
      subjectsResult.error?.message ?? sheetsResult.error?.message ?? "components",
    );
    return null;
  }

  const sheets = sheetsResult.data ?? [];
  const sheetIds = sheets.map((item) => item.id as string);
  const subjectBySheet = new Map(sheets.map((item) => [item.id as string, item.subject_id as string]));

  const scores: Record<string, string> = {};

  if (sheetIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("result_scores")
        .select("sheet_id, student_id, component_id, score")
        .in("sheet_id", sheetIds)
        .order("id", { ascending: true })
        .range(from, from + 999);

      if (error) {
        console.error("Unable to load scores:", error.message);
        return null;
      }

      for (const row of data ?? []) {
        const subjectId = subjectBySheet.get(row.sheet_id as string);

        if (subjectId) {
          scores[sk(row.student_id as string, subjectId, row.component_id as string)] = String(
            Number(row.score),
          );
        }
      }

      if ((data ?? []).length < 1000) break;
    }
  }

  const grades: Record<string, GradeInfo> = {};
  const publishedIds = sheets.filter((item) => item.status === "published").map((item) => item.id as string);

  if (publishedIds.length > 0) {
    const { data, error } = await admin
      .from("result_entries")
      .select("sheet_id, student_id, grade, percent")
      .in("sheet_id", publishedIds)
      .limit(5000);

    if (error) {
      console.error("Unable to load grades:", error.message);
      return null;
    }

    for (const row of data ?? []) {
      const subjectId = subjectBySheet.get(row.sheet_id as string);

      if (subjectId) {
        grades[gk(row.student_id as string, subjectId)] = {
          grade: row.grade as string,
          percent: Number(row.percent),
        };
      }
    }
  }

  const names = new Map((subjectsResult.data ?? []).map((item) => [item.id as string, item.name as string]));
  const sheetBySubject = new Map(sheets.map((item) => [item.subject_id as string, item]));

  const subjects: ScoringSubject[] = args.subjectIds
    .filter((id) => names.has(id))
    .map((id) => {
      const sheet = sheetBySubject.get(id);
      const state = (sheet?.status as SheetState | undefined) ?? "not_started";
      const frozen =
        sheet && state !== "draft" && Array.isArray(sheet.components)
          ? (sheet.components as { id: string; name: string; max: number }[]).map(
              (item): ScoreComponent => ({ id: item.id, name: item.name, max: Number(item.max) }),
            )
          : null;

      return {
        id,
        name: names.get(id) as string,
        sheetId: sheet ? (sheet.id as string) : null,
        state,
        locked: state === "submitted" || state === "published",
        components: frozen ?? active,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { students, subjects, scores, grades };
}
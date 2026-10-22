import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type SubjectResult = {
  subject: string;
  total: number;
  max: number;
  percent: number;
  grade: string;
  remark: string | null;
  breakdown: { name: string; score: number; max: number }[];
};

export type TermResult = {
  termId: string;
  termName: string;
  sessionName: string;
  startDate: string;
  className: string;
  subjects: SubjectResult[];
  average: number;
  position: number | null;
  outOf: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** All of a student's published results, grouped by term, oldest first. */
export async function loadStudentResults(
  admin: Admin,
  studentId: string,
): Promise<TermResult[] | null> {
  const entriesResult = await admin
    .from("result_entries")
    .select("sheet_id, total_score, max_total, percent, grade, remark")
    .eq("student_id", studentId);

  if (entriesResult.error) {
    console.error("Unable to load results:", entriesResult.error.message);
    return null;
  }

  const entries = entriesResult.data ?? [];

  if (entries.length === 0) return [];

  const sheetIds = entries.map((item) => item.sheet_id as string);

  const [sheetsResult, scoresResult] = await Promise.all([
    admin
      .from("result_sheets")
      .select("id, class_id, subject_id, term_id, components")
      .in("id", sheetIds)
      .eq("status", "published"),
    admin
      .from("result_scores")
      .select("sheet_id, component_id, score")
      .eq("student_id", studentId)
      .in("sheet_id", sheetIds),
  ]);

  const firstFailure = sheetsResult.error ?? scoresResult.error;

  if (firstFailure) {
    console.error("Unable to load result sheets:", firstFailure.message);
    return null;
  }

  const sheets = sheetsResult.data ?? [];

  if (sheets.length === 0) return [];

  const subjectIds = [...new Set(sheets.map((item) => item.subject_id as string))];
  const termIds = [...new Set(sheets.map((item) => item.term_id as string))];
  const classIds = [...new Set(sheets.map((item) => item.class_id as string))];

  const [subjectsResult, termsResult, classesResult] = await Promise.all([
    admin.from("subjects").select("id, name").in("id", subjectIds),
    admin
      .from("academic_terms")
      .select("id, name, start_date, session_id")
      .in("id", termIds),
    admin.from("classes").select("id, name").in("id", classIds),
  ]);

  const lookupFailure =
    subjectsResult.error ?? termsResult.error ?? classesResult.error;

  if (lookupFailure) {
    console.error("Unable to load result details:", lookupFailure.message);
    return null;
  }

  const sessionIds = [
    ...new Set((termsResult.data ?? []).map((item) => item.session_id as string)),
  ];

  const sessionsResult = await admin
    .from("academic_sessions")
    .select("id, name")
    .in("id", sessionIds);

  if (sessionsResult.error) {
    console.error("Unable to load sessions:", sessionsResult.error.message);
    return null;
  }

  const subjectName = new Map(
    (subjectsResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );
  const className = new Map(
    (classesResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );
  const sessionName = new Map(
    (sessionsResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );
  const termInfo = new Map(
    (termsResult.data ?? []).map((item) => [
      item.id as string,
      {
        name: item.name as string,
        startDate: item.start_date as string,
        sessionId: item.session_id as string,
      },
    ]),
  );
  const entryBySheet = new Map(entries.map((item) => [item.sheet_id as string, item]));
  const scoreByKey = new Map(
    (scoresResult.data ?? []).map((item) => [
      `${item.sheet_id}:${item.component_id}`,
      Number(item.score),
    ]),
  );

  const byTerm = new Map<string, typeof sheets>();

  for (const sheet of sheets) {
    const list = byTerm.get(sheet.term_id as string) ?? [];
    list.push(sheet);
    byTerm.set(sheet.term_id as string, list);
  }

  const results: TermResult[] = [];

  for (const [termId, termSheets] of byTerm) {
    const info = termInfo.get(termId);

    if (!info) continue;

    const subjects: SubjectResult[] = [];

    for (const sheet of termSheets) {
      const entry = entryBySheet.get(sheet.id as string);

      if (!entry) continue;

      const components = Array.isArray(sheet.components)
        ? (sheet.components as { id: string; name: string; max: number }[])
        : [];

      subjects.push({
        subject: subjectName.get(sheet.subject_id as string) ?? "Subject",
        total: Number(entry.total_score),
        max: Number(entry.max_total),
        percent: Number(entry.percent),
        grade: entry.grade as string,
        remark: (entry.remark as string | null) ?? null,
        breakdown: components.map((component) => ({
          name: component.name,
          score: scoreByKey.get(`${sheet.id}:${component.id}`) ?? 0,
          max: Number(component.max),
        })),
      });
    }

    if (subjects.length === 0) continue;

    subjects.sort((a, b) => a.subject.localeCompare(b.subject));

    const average = round2(
      subjects.reduce((sum, item) => sum + item.percent, 0) / subjects.length,
    );

    // Position: compare this student's average with classmates' averages.
    const classId = termSheets[0].class_id as string;
    let position: number | null = null;
    let outOf: number | null = null;

    const classSheets = await admin
      .from("result_sheets")
      .select("id")
      .eq("class_id", classId)
      .eq("term_id", termId)
      .eq("status", "published");

    if (!classSheets.error && (classSheets.data ?? []).length > 0) {
      const classEntries = await admin
        .from("result_entries")
        .select("student_id, percent")
        .in(
          "sheet_id",
          (classSheets.data ?? []).map((item) => item.id as string),
        );

      if (!classEntries.error) {
        const totals = new Map<string, { sum: number; count: number }>();

        for (const row of classEntries.data ?? []) {
          const current = totals.get(row.student_id as string) ?? { sum: 0, count: 0 };
          current.sum += Number(row.percent);
          current.count += 1;
          totals.set(row.student_id as string, current);
        }

        const averages = [...totals.values()].map((item) => item.sum / item.count);

        position = 1 + averages.filter((value) => value > average + 0.000001).length;
        outOf = averages.length;
      }
    }

    results.push({
      termId,
      termName: info.name,
      sessionName: sessionName.get(info.sessionId) ?? "",
      startDate: info.startDate,
      className: className.get(classId) ?? "Class",
      subjects,
      average,
      position,
      outOf,
    });
  }

  results.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return results;
}
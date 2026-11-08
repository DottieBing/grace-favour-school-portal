import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type Standing = {
  label: string | null;
  byStudent: Map<string, { average: number; position: number }>;
  outOf: number;
};

const EMPTY: Standing = { label: null, byStudent: new Map(), outOf: 0 };

/** Each student's average and position in the class's latest term with published results. */
export async function loadClassStanding(
  admin: Admin,
  classId: string,
): Promise<Standing | null> {
  const sheets = await admin
    .from("result_sheets")
    .select("id, term_id")
    .eq("class_id", classId)
    .eq("status", "published");

  if (sheets.error) {
    console.error("Unable to load published sheets:", sheets.error.message);
    return null;
  }

  const rows = sheets.data ?? [];

  if (rows.length === 0) return EMPTY;

  const termIds = [...new Set(rows.map((item) => item.term_id as string))];

  const terms = await admin
    .from("academic_terms")
    .select("id, name, start_date, session_id")
    .in("id", termIds);

  if (terms.error) {
    console.error("Unable to load terms:", terms.error.message);
    return null;
  }

  const latest = [...(terms.data ?? [])].sort((a, b) =>
    (b.start_date as string).localeCompare(a.start_date as string),
  )[0];

  if (!latest) return EMPTY;

  const session = await admin
    .from("academic_sessions")
    .select("name")
    .eq("id", latest.session_id as string)
    .maybeSingle();

  if (session.error) {
    console.error("Unable to load the session:", session.error.message);
    return null;
  }

  const sheetIds = rows
    .filter((item) => item.term_id === latest.id)
    .map((item) => item.id as string);

  const sums = new Map<string, { sum: number; count: number }>();

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("result_entries")
      .select("student_id, percent")
      .in("sheet_id", sheetIds)
      .order("id", { ascending: true })
      .range(from, from + 999);

    if (error) {
      console.error("Unable to load result entries:", error.message);
      return null;
    }

    for (const row of data ?? []) {
      const current = sums.get(row.student_id as string) ?? { sum: 0, count: 0 };
      current.sum += Number(row.percent);
      current.count += 1;
      sums.set(row.student_id as string, current);
    }

    if ((data ?? []).length < 1000) break;
  }

  const averages = new Map(
    [...sums.entries()].map(([id, value]) => [
      id,
      Math.round((value.sum / value.count) * 100) / 100,
    ]),
  );

  const all = [...averages.values()];
  const byStudent = new Map<string, { average: number; position: number }>();

  for (const [id, average] of averages) {
    byStudent.set(id, {
      average,
      position: 1 + all.filter((value) => value > average + 0.000001).length,
    });
  }

  return {
    label: `${latest.name as string}, ${(session.data?.name as string | undefined) ?? ""}`,
    byStudent,
    outOf: all.length,
  };
}
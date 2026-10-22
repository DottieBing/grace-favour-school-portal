import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadActiveComponents } from "@/lib/results/components";
import {
  scoreKey,
  type GradeInfo,
  type ResultStudent,
  type ScoreComponent,
  type SheetState,
} from "@/lib/results/types";

type Admin = ReturnType<typeof createAdminClient>;

export type SheetData = {
  sheetId: string | null;
  state: SheetState;
  components: ScoreComponent[];
  students: ResultStudent[];
  initial: Record<string, string>;
  grades: Record<string, GradeInfo>;
};

type StudentRow = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

const STUDENT_COLUMNS =
  "id, admission_number, first_name, middle_name, last_name";

function toStudent(row: StudentRow): ResultStudent {
  return {
    id: row.id,
    name: [row.first_name, row.middle_name, row.last_name]
      .filter(Boolean)
      .join(" "),
    admissionNumber: row.admission_number,
  };
}

/** Everything needed to show one subject's result sheet for one term. */
export async function loadSheet(
  admin: Admin,
  args: { classId: string; subjectId: string; termId: string },
): Promise<SheetData | null> {
  const { data: sheet, error: sheetError } = await admin
    .from("result_sheets")
    .select("id, status, components")
    .eq("class_id", args.classId)
    .eq("subject_id", args.subjectId)
    .eq("term_id", args.termId)
    .maybeSingle();

  if (sheetError) {
    console.error("Unable to load the result sheet:", sheetError.message);
    return null;
  }

  const state: SheetState = sheet
    ? (sheet.status as SheetState)
    : "not_started";

  // A submitted sheet keeps the components it was scored against.
  let components: ScoreComponent[] | null;

  if (sheet && state !== "draft" && Array.isArray(sheet.components)) {
    components = (
      sheet.components as { id: string; name: string; max: number }[]
    ).map((item) => ({
      id: item.id,
      name: item.name,
      max: Number(item.max),
    }));
  } else {
    components = await loadActiveComponents(admin);
  }

  if (!components) return null;

  const scoreRows: { student_id: string; component_id: string; score: number }[] =
    [];

  if (sheet) {
    const { data, error } = await admin
      .from("result_scores")
      .select("student_id, component_id, score")
      .eq("sheet_id", sheet.id);

    if (error) {
      console.error("Unable to load scores:", error.message);
      return null;
    }

    scoreRows.push(...((data ?? []) as typeof scoreRows));
  }

  const { data: rosterRows, error: rosterError } = await admin
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("current_class_id", args.classId)
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (rosterError) {
    console.error("Unable to load the class list:", rosterError.message);
    return null;
  }

  const students = ((rosterRows ?? []) as StudentRow[]).map(toStudent);
  const known = new Set(students.map((item) => item.id));

  // Students who have scores but have since left the class still show.
  const missing = [
    ...new Set(
      scoreRows.map((row) => row.student_id).filter((id) => !known.has(id)),
    ),
  ];

  if (missing.length > 0) {
    const { data, error } = await admin
      .from("students")
      .select(STUDENT_COLUMNS)
      .in("id", missing);

    if (error) {
      console.error("Unable to load students:", error.message);
      return null;
    }

    students.push(...((data ?? []) as StudentRow[]).map(toStudent));
  }

  const initial: Record<string, string> = {};

  for (const row of scoreRows) {
    initial[scoreKey(row.student_id, row.component_id)] = String(
      Number(row.score),
    );
  }

  const grades: Record<string, GradeInfo> = {};

  if (sheet && state === "published") {
    const { data, error } = await admin
      .from("result_entries")
      .select("student_id, grade, percent")
      .eq("sheet_id", sheet.id);

    if (error) {
      console.error("Unable to load grades:", error.message);
      return null;
    }

    for (const row of data ?? []) {
      grades[row.student_id as string] = {
        grade: row.grade as string,
        percent: Number(row.percent),
      };
    }
  }

  return {
    sheetId: sheet ? (sheet.id as string) : null,
    state,
    components,
    students,
    initial,
    grades,
  };
}
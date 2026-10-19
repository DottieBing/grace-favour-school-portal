import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AttendanceStatus,
  Mark,
  RegisterState,
  RegisterStudent,
} from "@/lib/attendance/types";

type Admin = ReturnType<typeof createAdminClient>;

export type ClassRegisterData = {
  students: RegisterStudent[];
  register: RegisterState | null;
  marks: Record<string, Mark>;
};

/** Loads each class's active students and its register for one day. */
export async function loadRegisters(
  admin: Admin,
  classIds: string[],
  date: string,
): Promise<Map<string, ClassRegisterData> | null> {
  const [studentsResult, registersResult] = await Promise.all([
    admin
      .from("students")
      .select(
        "id, admission_number, first_name, middle_name, last_name, current_class_id",
      )
      .eq("status", "active")
      .in("current_class_id", classIds)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    admin
      .from("attendance_registers")
      .select("id, class_id, status, submitted_at")
      .eq("attendance_date", date)
      .in("class_id", classIds),
  ]);

  if (studentsResult.error || registersResult.error) {
    console.error(
      "Unable to load registers:",
      studentsResult.error?.message ?? registersResult.error?.message,
    );
    return null;
  }

  const registerIds = (registersResult.data ?? []).map((item) => item.id as string);

  let recordRows: {
    register_id: string;
    student_id: string;
    status: string;
    note: string | null;
  }[] = [];

  if (registerIds.length > 0) {
    const { data, error } = await admin
      .from("attendance_records")
      .select("register_id, student_id, status, note")
      .in("register_id", registerIds);

    if (error) {
      console.error("Unable to load attendance marks:", error.message);
      return null;
    }

    recordRows = (data ?? []) as typeof recordRows;
  }

  const result = new Map<string, ClassRegisterData>();

  for (const classId of classIds) {
    result.set(classId, { students: [], register: null, marks: {} });
  }

  for (const row of studentsResult.data ?? []) {
    const entry = result.get(row.current_class_id as string);

    if (!entry) continue;

    entry.students.push({
      id: row.id as string,
      name: [row.first_name, row.middle_name, row.last_name]
        .filter(Boolean)
        .join(" "),
      admissionNumber: row.admission_number as string,
    });
  }

  const classByRegister = new Map<string, string>();

  for (const row of registersResult.data ?? []) {
    const entry = result.get(row.class_id as string);

    if (!entry) continue;

    entry.register = {
      id: row.id as string,
      status: row.status as RegisterState["status"],
      submittedAt: row.submitted_at as string,
    };

    classByRegister.set(row.id as string, row.class_id as string);
  }

  for (const record of recordRows) {
    const classId = classByRegister.get(record.register_id);
    const entry = classId ? result.get(classId) : undefined;

    if (!entry) continue;

    entry.marks[record.student_id] = {
      status: record.status as AttendanceStatus,
      note: record.note ?? "",
    };
  }

  return result;
}
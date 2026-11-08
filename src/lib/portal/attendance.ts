import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

type Status = "present" | "late" | "absent";

export type AttendanceSummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  rate: number | null;
  recent: { date: string; status: Status }[];
};

type Raw = {
  status: string;
  attendance_registers: { attendance_date: string } | { attendance_date: string }[] | null;
};

/** Late counts as attended, the same rule as everywhere else. */
export async function loadAttendanceSummary(
  admin: Admin,
  studentId: string,
): Promise<AttendanceSummary | null> {
  const { data, error } = await admin
    .from("attendance_records")
    .select("status, attendance_registers!inner(attendance_date, status)")
    .eq("student_id", studentId)
    .eq("attendance_registers.status", "submitted")
    .limit(1000);

  if (error) {
    console.error("Unable to load attendance:", error.message);
    return null;
  }

  const rows = ((data ?? []) as unknown as Raw[])
    .map((row) => {
      const register = Array.isArray(row.attendance_registers)
        ? row.attendance_registers[0]
        : row.attendance_registers;

      return register ? { date: register.attendance_date, status: row.status as Status } : null;
    })
    .filter((row): row is { date: string; status: Status } => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const present = rows.filter((row) => row.status === "present").length;
  const late = rows.filter((row) => row.status === "late").length;
  const absent = rows.filter((row) => row.status === "absent").length;

  return {
    total: rows.length,
    present,
    late,
    absent,
    rate: rows.length === 0 ? null : Math.round(((present + late) / rows.length) * 100),
    recent: rows.slice(-14),
  };
}
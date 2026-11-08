import "server-only";

import { SCHOOL_TIME_ZONE, todayInSchool } from "@/lib/attendance/dates";
import type { SheetState } from "@/lib/results/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTeacherAgenda } from "@/lib/timetable/agenda";
import type { AgendaItem } from "@/lib/timetable/types";

type Admin = ReturnType<typeof createAdminClient>;

/** Today's date, time, hour and weekday (1 = Monday) in the school's time zone. */
export function schoolNow() {
  const date = todayInSchool();

  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: SCHOOL_TIME_ZONE,
  });

  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();

  return {
    date,
    time: time.slice(0, 5),
    hour: Number(time.slice(0, 2)),
    weekday: jsDay === 0 ? 7 : jsDay,
  };
}

export function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export type OverviewClass = {
  id: string;
  name: string;
  studentCount: number;
  isClassTeacher: boolean;
  attendance: "none" | "submitted" | "reopened";
  subjects: { id: string; name: string; state: SheetState }[];
};

export type TeacherOverview = {
  classes: OverviewClass[];
  lessons: AgendaItem[];
};

export async function loadTeacherOverview(
  admin: Admin,
  args: {
    staffId: string;
    sessionId: string;
    termId: string;
    today: string;
    weekday: number;
  },
): Promise<TeacherOverview | null> {
  const [assignmentsResult, agenda] = await Promise.all([
    admin
      .from("teacher_assignments")
      .select("class_id, subject_id, is_class_teacher")
      .eq("teacher_id", args.staffId)
      .eq("academic_session_id", args.sessionId)
      .eq("is_active", true),
    loadTeacherAgenda(admin, args.staffId, args.sessionId),
  ]);

  if (assignmentsResult.error || !agenda) {
    console.error(
      "Unable to load the teacher overview:",
      assignmentsResult.error?.message ?? "agenda",
    );
    return null;
  }

  const lessons = agenda
    .filter((item) => item.day === args.weekday && !item.isBreak)
    .sort((a, b) => a.start.localeCompare(b.start));

  const assignments = assignmentsResult.data ?? [];

  if (assignments.length === 0) return { classes: [], lessons };

  const classIds = [...new Set(assignments.map((item) => item.class_id as string))];
  const subjectIds = [...new Set(assignments.map((item) => item.subject_id as string))];

  const [classesResult, subjectsResult, studentsResult, registersResult, sheetsResult] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name")
        .in("id", classIds)
        .eq("is_active", true)
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      admin.from("subjects").select("id, name").in("id", subjectIds),
      admin
        .from("students")
        .select("current_class_id")
        .eq("status", "active")
        .in("current_class_id", classIds)
        .limit(2000),
      admin
        .from("attendance_registers")
        .select("class_id, status")
        .eq("attendance_date", args.today)
        .in("class_id", classIds),
      admin
        .from("result_sheets")
        .select("class_id, subject_id, status")
        .eq("term_id", args.termId)
        .in("class_id", classIds)
        .in("subject_id", subjectIds),
    ]);

  const failure =
    classesResult.error ??
    subjectsResult.error ??
    studentsResult.error ??
    registersResult.error ??
    sheetsResult.error;

  if (failure) {
    console.error("Unable to load the teacher overview:", failure.message);
    return null;
  }

  const subjectName = new Map(
    (subjectsResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );

  const counts = new Map<string, number>();

  for (const row of studentsResult.data ?? []) {
    const id = row.current_class_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const registerStatus = new Map(
    (registersResult.data ?? []).map((item) => [
      item.class_id as string,
      item.status as "submitted" | "reopened",
    ]),
  );

  const sheetState = new Map(
    (sheetsResult.data ?? []).map((item) => [
      `${item.class_id}:${item.subject_id}`,
      item.status as SheetState,
    ]),
  );

  const classes: OverviewClass[] = (classesResult.data ?? []).map((item) => {
    const id = item.id as string;
    const mine = assignments.filter((entry) => entry.class_id === id);

    return {
      id,
      name: item.name as string,
      studentCount: counts.get(id) ?? 0,
      isClassTeacher: mine.some((entry) => entry.is_class_teacher),
      attendance: registerStatus.get(id) ?? "none",
      subjects: mine
        .map((entry) => ({
          id: entry.subject_id as string,
          name: subjectName.get(entry.subject_id as string) ?? "Subject",
          state: sheetState.get(`${id}:${entry.subject_id}`) ?? ("not_started" as SheetState),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  return { classes, lessons };
}
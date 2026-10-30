import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadClassSchedule } from "@/lib/timetable/schedule";
import { appliesOn, fmtTime } from "@/lib/timetable/time";
import type { AgendaItem } from "@/lib/timetable/types";

type Admin = ReturnType<typeof createAdminClient>;

type One<T> = T | T[] | null;

function first<T>(value: One<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Everything one teacher teaches this session, across all their classes. */
export async function loadTeacherAgenda(
  admin: Admin,
  teacherId: string,
  sessionId: string,
): Promise<AgendaItem[] | null> {
  const { data, error } = await admin
    .from("timetable_entries")
    .select(
      "day, label, room, timetable_periods(start_time, end_time), classes(name), subjects(name)",
    )
    .eq("session_id", sessionId)
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("Unable to load the teacher's timetable:", error.message);
    return null;
  }

  type Raw = {
    day: number;
    label: string | null;
    room: string | null;
    timetable_periods: One<{ start_time: string; end_time: string }>;
    classes: One<{ name: string }>;
    subjects: One<{ name: string }>;
  };

  const items: AgendaItem[] = [];

  for (const row of (data ?? []) as unknown as Raw[]) {
    const period = first(row.timetable_periods);

    if (!period) continue;

    items.push({
      day: row.day,
      start: fmtTime(period.start_time),
      end: fmtTime(period.end_time),
      title: first(row.subjects)?.name ?? row.label ?? "Class",
      subtitle: [first(row.classes)?.name, row.room].filter(Boolean).join(" · "),
    });
  }

  return items;
}

/** One class's week, including its breaks. */
export async function loadClassAgenda(
  admin: Admin,
  classId: string,
  sessionId: string,
  days: number[],
): Promise<AgendaItem[] | null> {
  const schedule = await loadClassSchedule(admin, classId);

  if (!schedule) return null;

  const { data, error } = await admin
    .from("timetable_entries")
    .select("day, label, room, period_id, subjects(name), staff(full_name)")
    .eq("session_id", sessionId)
    .eq("class_id", classId);

  if (error) {
    console.error("Unable to load the class timetable:", error.message);
    return null;
  }

  type Raw = {
    day: number;
    label: string | null;
    room: string | null;
    period_id: string;
    subjects: One<{ name: string }>;
    staff: One<{ full_name: string | null }>;
  };

  const periods = new Map(schedule.periods.map((item) => [item.id, item]));
  const items: AgendaItem[] = [];

  for (const row of (data ?? []) as unknown as Raw[]) {
    const period = periods.get(row.period_id);

    if (!period) continue;

    items.push({
      day: row.day,
      start: period.start,
      end: period.end,
      title: first(row.subjects)?.name ?? row.label ?? "Class",
      subtitle: [first(row.staff)?.full_name, row.room].filter(Boolean).join(" · "),
    });
  }

  for (const period of schedule.periods.filter((item) => item.isBreak)) {
    for (const day of days) {
      if (appliesOn(period.days, day)) {
        items.push({
          day,
          start: period.start,
          end: period.end,
          title: period.name,
          isBreak: true,
        });
      }
    }
  }

  return items;
}
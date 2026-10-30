import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fmtTime } from "@/lib/timetable/time";
import type { PeriodInfo } from "@/lib/timetable/types";

type Admin = ReturnType<typeof createAdminClient>;

export type ClassSchedule = {
  scheduleId: string | null;
  scheduleName: string | null;
  periods: PeriodInfo[];
};

/** The schedule a class uses (its own, or the default) and that schedule's periods. */
export async function loadClassSchedule(
  admin: Admin,
  classId: string,
): Promise<ClassSchedule | null> {
  const { data: cls, error } = await admin
    .from("classes")
    .select("timetable_schedule_id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the class:", error.message);
    return null;
  }

  let scheduleId = (cls?.timetable_schedule_id as string | null) ?? null;

  if (!scheduleId) {
    const fallback = await admin
      .from("timetable_schedules")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    if (fallback.error) {
      console.error("Unable to load the default schedule:", fallback.error.message);
      return null;
    }

    scheduleId = (fallback.data?.id as string | undefined) ?? null;
  }

  if (!scheduleId) return { scheduleId: null, scheduleName: null, periods: [] };

  const [schedule, periods] = await Promise.all([
    admin.from("timetable_schedules").select("name").eq("id", scheduleId).maybeSingle(),
    admin
      .from("timetable_periods")
      .select("id, name, start_time, end_time, is_break, days")
      .eq("schedule_id", scheduleId)
      .order("start_time", { ascending: true }),
  ]);

  if (schedule.error || periods.error) {
    console.error(
      "Unable to load the schedule:",
      schedule.error?.message ?? periods.error?.message,
    );
    return null;
  }

  return {
    scheduleId,
    scheduleName: (schedule.data?.name as string | undefined) ?? null,
    periods: (periods.data ?? []).map((item) => ({
      id: item.id as string,
      name: item.name as string,
      start: fmtTime(item.start_time as string),
      end: fmtTime(item.end_time as string),
      isBreak: item.is_break as boolean,
      days: (item.days as number[] | null) ?? null,
    })),
  };
}
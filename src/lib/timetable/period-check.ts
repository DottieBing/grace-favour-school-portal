import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fmtTime, periodsClash } from "@/lib/timetable/time";

type Admin = ReturnType<typeof createAdminClient>;

/** Periods in one schedule can't overlap on a shared day, or a class would be double-booked. */
export async function checkPeriod(
  admin: Admin,
  args: {
    scheduleId: string;
    id?: string;
    start: string;
    end: string;
    days: number[] | null;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("timetable_periods")
    .select("id, name, start_time, end_time, days")
    .eq("schedule_id", args.scheduleId);

  if (error) {
    console.error("Unable to check the other periods:", error.message);
    return "Unable to check the other periods.";
  }

  for (const row of data ?? []) {
    if (row.id === args.id) continue;

    const other = {
      start: fmtTime(row.start_time as string),
      end: fmtTime(row.end_time as string),
      days: (row.days as number[] | null) ?? null,
    };

    if (periodsClash({ start: args.start, end: args.end, days: args.days }, other)) {
      return `This overlaps "${row.name as string}" (${other.start} to ${other.end}) on a shared day.`;
    }
  }

  return null;
}
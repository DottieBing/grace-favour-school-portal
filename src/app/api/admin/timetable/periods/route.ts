import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { checkPeriod } from "@/lib/timetable/period-check";
import { createAdminClient } from "@/lib/supabase/admin";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");

const schema = z
  .object({
    scheduleId: z.uuid(),
    name: z.string().trim().min(1, "Enter a name.").max(40),
    startTime: time,
    endTime: time,
    isBreak: z.boolean(),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7).nullable(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

export async function POST(request: Request) {
  const access = await getAdminAccess("timetable", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid period.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const days = input.days ? [...new Set(input.days)].sort((a, b) => a - b) : null;
  const admin = createAdminClient();

  const { data: schedule, error: scheduleError } = await admin
    .from("timetable_schedules")
    .select("id")
    .eq("id", input.scheduleId)
    .maybeSingle();

  if (scheduleError) {
    console.error("Unable to load the schedule:", scheduleError.message);
    return NextResponse.json({ error: "Unable to save the period." }, { status: 500 });
  }

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
  }

  const problem = await checkPeriod(admin, {
    scheduleId: input.scheduleId,
    start: input.startTime,
    end: input.endTime,
    days,
  });

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 409 });
  }

  const { error } = await admin.from("timetable_periods").insert({
    schedule_id: input.scheduleId,
    name: input.name,
    start_time: input.startTime,
    end_time: input.endTime,
    is_break: input.isBreak,
    days,
  });

  if (error) {
    console.error("Period creation failed:", error.message);
    return NextResponse.json({ error: "Unable to save the period." }, { status: 500 });
  }

  return NextResponse.json({ message: "Period added." }, { status: 201 });
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { checkPeriod } from "@/lib/timetable/period-check";
import { createAdminClient } from "@/lib/supabase/admin";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");

const schema = z
  .object({
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("timetable", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid period id." }, { status: 400 });
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

  const { data: existing, error: loadError } = await admin
    .from("timetable_periods")
    .select("id, schedule_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load the period:", loadError.message);
    return NextResponse.json({ error: "Unable to save the period." }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Period not found." }, { status: 404 });
  }

  const problem = await checkPeriod(admin, {
    scheduleId: existing.schedule_id as string,
    id,
    start: input.startTime,
    end: input.endTime,
    days,
  });

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 409 });
  }

  const { error } = await admin
    .from("timetable_periods")
    .update({
      name: input.name,
      start_time: input.startTime,
      end_time: input.endTime,
      is_break: input.isBreak,
      days,
    })
    .eq("id", id);

  if (error) {
    console.error("Period update failed:", error.message);
    return NextResponse.json({ error: "Unable to save the period." }, { status: 500 });
  }

  // Slots that no longer make sense are cleared: all of them for a break, or the
  // days this period no longer runs on.
  if (input.isBreak) {
    await admin.from("timetable_entries").delete().eq("period_id", id);
  } else if (days) {
    await admin
      .from("timetable_entries")
      .delete()
      .eq("period_id", id)
      .not("day", "in", `(${days.join(",")})`);
  }

  return NextResponse.json({ message: "Period updated." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("timetable", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid period id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("timetable_periods").delete().eq("id", id);

  if (error) {
    console.error("Period deletion failed:", error.message);
    return NextResponse.json({ error: "Unable to delete the period." }, { status: 500 });
  }

  return NextResponse.json({ message: "Period deleted." });
}
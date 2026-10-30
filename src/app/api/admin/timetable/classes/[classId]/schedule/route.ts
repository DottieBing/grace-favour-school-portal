import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ scheduleId: z.uuid().nullable() });

export async function PUT(
  request: Request,
  context: { params: Promise<{ classId: string }> },
) {
  const access = await getAdminAccess("timetable", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { classId } = await context.params;

  if (!z.uuid().safeParse(classId).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let scheduleId: string | null;

  try {
    const body: unknown = await request.json();
    scheduleId = schema.parse(body).scheduleId;
  } catch {
    return NextResponse.json({ error: "Choose a schedule." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("timetable_schedule_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    console.error("Unable to load the class:", classError.message);
    return NextResponse.json({ error: "Unable to change the schedule." }, { status: 500 });
  }

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (scheduleId) {
    const { data: schedule, error } = await admin
      .from("timetable_schedules")
      .select("id")
      .eq("id", scheduleId)
      .maybeSingle();

    if (error || !schedule) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
  }

  if ((cls.timetable_schedule_id as string | null) === scheduleId) {
    return NextResponse.json({ message: "No change." });
  }

  // Slots belong to the old schedule's periods, so they can't be kept.
  const { error: clearError } = await admin
    .from("timetable_entries")
    .delete()
    .eq("class_id", classId);

  if (clearError) {
    console.error("Clearing the timetable failed:", clearError.message);
    return NextResponse.json({ error: "Unable to change the schedule." }, { status: 500 });
  }

  const { error } = await admin
    .from("classes")
    .update({ timetable_schedule_id: scheduleId })
    .eq("id", classId);

  if (error) {
    console.error("Changing the schedule failed:", error.message);
    return NextResponse.json({ error: "Unable to change the schedule." }, { status: 500 });
  }

  return NextResponse.json({ message: "Schedule changed." });
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(60).optional(),
  isDefault: z.literal(true).optional(),
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
    return NextResponse.json({ error: "Invalid schedule id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (input.name === undefined && input.isDefault === undefined) {
    return NextResponse.json({ error: "There is nothing to change." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (input.name !== undefined) {
    const { data, error } = await admin
      .from("timetable_schedules")
      .update({ name: input.name })
      .eq("id", id)
      .select("id");

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A schedule with this name already exists." },
          { status: 409 },
        );
      }

      console.error("Schedule rename failed:", error.message);
      return NextResponse.json({ error: "Unable to save the changes." }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
  }

  if (input.isDefault) {
    const { error } = await admin.rpc("set_default_schedule", { p_id: id });

    if (error) {
      if (error.code === "P0002") {
        return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
      }

      console.error("Setting the default failed:", error.message);
      return NextResponse.json({ error: "Unable to change the default." }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Schedule updated." });
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
    return NextResponse.json({ error: "Invalid schedule id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: schedule, error: loadError } = await admin
    .from("timetable_schedules")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load the schedule:", loadError.message);
    return NextResponse.json({ error: "Unable to delete the schedule." }, { status: 500 });
  }

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
  }

  if (schedule.is_default) {
    return NextResponse.json(
      { error: "Make another schedule the default before deleting this one." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("timetable_schedules").delete().eq("id", id);

  if (error) {
    console.error("Schedule deletion failed:", error.message);
    return NextResponse.json({ error: "Unable to delete the schedule." }, { status: 500 });
  }

  return NextResponse.json({ message: "Schedule deleted." });
}
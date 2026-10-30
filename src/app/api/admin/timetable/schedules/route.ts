import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ name: z.string().trim().min(1, "Enter a name.").max(60) });

export async function POST(request: Request) {
  const access = await getAdminAccess("timetable", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let name: string;

  try {
    const body: unknown = await request.json();
    name = schema.parse(body).name;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("timetable_schedules")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("Unable to count schedules:", countError.message);
    return NextResponse.json({ error: "Unable to create the schedule." }, { status: 500 });
  }

  const { error } = await admin
    .from("timetable_schedules")
    .insert({ name, is_default: (count ?? 0) === 0 });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A schedule with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Schedule creation failed:", error.message);
    return NextResponse.json({ error: "Unable to create the schedule." }, { status: 500 });
  }

  return NextResponse.json({ message: "Schedule created." }, { status: 201 });
}
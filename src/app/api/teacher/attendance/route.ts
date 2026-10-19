import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { isWeekday, todayInSchool } from "@/lib/attendance/dates";
import { recordsSchema } from "@/lib/attendance/schema";
import { saveRegister } from "@/lib/attendance/save";
import { findTermForDate } from "@/lib/attendance/terms";

const schema = z.object({ classId: z.uuid(), records: recordsSchema });

export async function POST(request: Request) {
  const access = await getAccess("teacher");

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
        ? (error.issues[0]?.message ?? "Invalid register.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { error: "No current term is set. Contact the administrator." },
      { status: 409 },
    );
  }

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", access.user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Unable to load staff record:", staffError.message);
    return NextResponse.json(
      { error: "Unable to verify your account." },
      { status: 500 },
    );
  }

  if (!staff) {
    return NextResponse.json(
      { error: "Your staff record wasn't found." },
      { status: 403 },
    );
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", staff.id)
    .eq("class_id", input.classId)
    .eq("academic_session_id", session.id)
    .eq("is_class_teacher", true)
    .eq("is_active", true)
    .limit(1);

  if (assignmentError) {
    console.error("Unable to check assignment:", assignmentError.message);
    return NextResponse.json(
      { error: "Unable to verify your class." },
      { status: 500 },
    );
  }

  if (!assignment || assignment.length === 0) {
    return NextResponse.json(
      { error: "You are not the class teacher of this class." },
      { status: 403 },
    );
  }

  const today = todayInSchool();

  if (!isWeekday(today)) {
    return NextResponse.json(
      { error: "Attendance is only marked on school days (Monday to Friday)." },
      { status: 400 },
    );
  }

  const lookup = await findTermForDate(admin, today);

  if (!lookup.ok) {
    return NextResponse.json(
      { error: "Unable to check the school term." },
      { status: 500 },
    );
  }

  if (!lookup.term) {
    return NextResponse.json(
      { error: "Today isn't within a school term." },
      { status: 400 },
    );
  }

  if (lookup.term.sessionId !== session.id) {
    return NextResponse.json(
      {
        error:
          "Today's date doesn't match the current term. Contact the administrator.",
      },
      { status: 409 },
    );
  }

  const outcome = await saveRegister(admin, {
    classId: input.classId,
    date: today,
    termId: lookup.term.id,
    actorId: access.user.id,
    isAdmin: false,
    records: input.records,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.message },
      { status: outcome.status },
    );
  }

  return NextResponse.json({ message: "Register submitted." }, { status: 201 });
}
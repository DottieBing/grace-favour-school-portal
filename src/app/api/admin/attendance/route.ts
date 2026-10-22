import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWeekday, todayInSchool } from "@/lib/attendance/dates";
import { recordsSchema } from "@/lib/attendance/schema";
import { saveRegister } from "@/lib/attendance/save";
import { findTermForDate } from "@/lib/attendance/terms";

const schema = z.object({
  classId: z.uuid(),
  date: z.string().date("Enter a valid date."),
  records: recordsSchema,
});

export async function POST(request: Request) {
  const access = await getAdminAccess("attendance", "manage");

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

  if (input.date > todayInSchool()) {
    return NextResponse.json(
      { error: "You can't mark attendance for a future date." },
      { status: 400 },
    );
  }

  if (!isWeekday(input.date)) {
    return NextResponse.json(
      { error: "Attendance is only marked on school days (Monday to Friday)." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const lookup = await findTermForDate(admin, input.date);

  if (!lookup.ok) {
    return NextResponse.json(
      { error: "Unable to check the school term." },
      { status: 500 },
    );
  }

  if (!lookup.term) {
    return NextResponse.json(
      { error: "That date isn't within a school term." },
      { status: 400 },
    );
  }

  const outcome = await saveRegister(admin, {
    classId: input.classId,
    date: input.date,
    termId: lookup.term.id,
    actorId: access.user.id,
    isAdmin: true,
    records: input.records,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.message },
      { status: outcome.status },
    );
  }

  return NextResponse.json({ message: "Register saved." }, { status: 201 });
}
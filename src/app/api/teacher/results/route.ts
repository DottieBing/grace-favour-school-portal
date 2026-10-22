import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { saveSchema } from "@/lib/results/schema";
import { saveSheet } from "@/lib/results/save";

export async function POST(request: Request) {
  const access = await getAccess("teacher");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let input: z.infer<typeof saveSchema>;

  try {
    const body: unknown = await request.json();
    input = saveSchema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid results.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [session, term] = await Promise.all([
    getCurrentSession(),
    getCurrentTerm(),
  ]);

  if (!session || !term) {
    return NextResponse.json(
      { error: "No current term is set. Contact the administrator." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

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
    .eq("subject_id", input.subjectId)
    .eq("academic_session_id", session.id)
    .eq("is_active", true)
    .limit(1);

  if (assignmentError) {
    console.error("Unable to check assignment:", assignmentError.message);
    return NextResponse.json(
      { error: "Unable to verify your subject." },
      { status: 500 },
    );
  }

  if (!assignment || assignment.length === 0) {
    return NextResponse.json(
      { error: "You are not assigned to teach this subject in this class." },
      { status: 403 },
    );
  }

  const outcome = await saveSheet(admin, {
    classId: input.classId,
    subjectId: input.subjectId,
    termId: term.id,
    actorId: access.user.id,
    submit: input.submit,
    scores: input.scores,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.message },
      { status: outcome.status },
    );
  }

  return NextResponse.json(
    { message: input.submit ? "Results submitted." : "Draft saved." },
    { status: 201 },
  );
}
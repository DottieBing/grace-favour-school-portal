import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";

const schema = z.object({
  teacherId: z.uuid(),
  subjectIds: z
    .array(z.uuid())
    .min(1, "Choose at least one subject.")
    .max(30),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("classes", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let teacherId: string;
  let subjectIds: string[];

  try {
    const body: unknown = await request.json();
    const parsed = schema.parse(body);
    teacherId = parsed.teacherId;
    subjectIds = [...new Set(parsed.subjectIds)];
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid assignment details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { error: "Set a current term before assigning teachers." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  // The class must exist and be active.
  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (classError) {
    console.error("Unable to load class:", classError.message);
    return NextResponse.json(
      { error: "Unable to load the class." },
      { status: 500 },
    );
  }

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (!cls.is_active) {
    return NextResponse.json(
      { error: "This class is inactive." },
      { status: 400 },
    );
  }

  // The teacher must be active teaching staff.
  const { data: teacher, error: teacherError } = await admin
    .from("staff")
    .select("id, staff_type, is_active")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherError) {
    console.error("Unable to load teacher:", teacherError.message);
    return NextResponse.json(
      { error: "Unable to load the teacher." },
      { status: 500 },
    );
  }

  if (!teacher || teacher.staff_type !== "teaching") {
    return NextResponse.json(
      { error: "Only teaching staff can be assigned to classes." },
      { status: 400 },
    );
  }

  if (!teacher.is_active) {
    return NextResponse.json(
      { error: "This teacher is inactive." },
      { status: 400 },
    );
  }

  // Every subject must be active and taken by this class.
  const [linksResult, subjectsResult] = await Promise.all([
    admin
      .from("class_subjects")
      .select("subject_id")
      .eq("class_id", id)
      .eq("is_active", true)
      .in("subject_id", subjectIds),
    admin.from("subjects").select("id, is_active").in("id", subjectIds),
  ]);

  if (linksResult.error || subjectsResult.error) {
    console.error(
      "Unable to verify subjects:",
      linksResult.error?.message ?? subjectsResult.error?.message,
    );
    return NextResponse.json(
      { error: "Unable to verify the subjects." },
      { status: 500 },
    );
  }

  if (
    (linksResult.data ?? []).length !== subjectIds.length ||
    (subjectsResult.data ?? []).length !== subjectIds.length ||
    (subjectsResult.data ?? []).some((subject) => !subject.is_active)
  ) {
    return NextResponse.json(
      {
        error:
          "One or more subjects aren't taken by this class. Refresh and try again.",
      },
      { status: 400 },
    );
  }

  // Nobody else may already teach any of these subjects in this class.
  const { data: existing, error: existingError } = await admin
    .from("teacher_assignments")
    .select("teacher_id, subject_id, is_class_teacher")
    .eq("class_id", id)
    .eq("academic_session_id", session.id)
    .eq("is_active", true);

  if (existingError) {
    console.error("Unable to check assignments:", existingError.message);
    return NextResponse.json(
      { error: "Unable to check existing assignments." },
      { status: 500 },
    );
  }

  const taken = (existing ?? []).some(
    (row) =>
      subjectIds.includes(row.subject_id as string) &&
      row.teacher_id !== teacherId,
  );

  if (taken) {
    return NextResponse.json(
      {
        error:
          "Another teacher already has one of these subjects in this class. Remove that assignment first.",
      },
      { status: 409 },
    );
  }

  // New rows inherit the class teacher flag if this teacher already holds it.
  const isClassTeacher = (existing ?? []).some(
    (row) => row.teacher_id === teacherId && row.is_class_teacher,
  );

  const { error: upsertError } = await admin.from("teacher_assignments").upsert(
    subjectIds.map((subjectId) => ({
      teacher_id: teacherId,
      class_id: id,
      subject_id: subjectId,
      academic_session_id: session.id,
      is_class_teacher: isClassTeacher,
      is_active: true,
    })),
    { onConflict: "teacher_id,class_id,subject_id,academic_session_id" },
  );

  if (upsertError) {
    if (upsertError.code === "23505") {
      return NextResponse.json(
        { error: "One of these subjects was just assigned to someone else." },
        { status: 409 },
      );
    }

    console.error("Assignment failed:", upsertError.message);

    return NextResponse.json(
      { error: "Unable to save the assignment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Teacher assigned." }, { status: 201 });
}
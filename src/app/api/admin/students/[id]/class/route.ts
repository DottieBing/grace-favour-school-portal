import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ classId: z.uuid("Choose a class.") });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
  }

  let classId: string;

  try {
    const body: unknown = await request.json();
    classId = schema.parse(body).classId;
  } catch {
    return NextResponse.json({ error: "Choose a class." }, { status: 400 });
  }

  const admin = createAdminClient();

  const [studentResult, classResult] = await Promise.all([
    admin
      .from("students")
      .select("id, status, current_class_id")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("classes")
      .select("id, is_active")
      .eq("id", classId)
      .maybeSingle(),
  ]);

  if (studentResult.error || classResult.error) {
    console.error(
      "Unable to load records:",
      studentResult.error?.message ?? classResult.error?.message,
    );
    return NextResponse.json(
      { error: "Unable to load the records." },
      { status: 500 },
    );
  }

  const student = studentResult.data;
  const cls = classResult.data;

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  if (student.status !== "active") {
    return NextResponse.json(
      { error: "Only active students can be moved. Reactivate them first." },
      { status: 400 },
    );
  }

  if (!cls || !cls.is_active) {
    return NextResponse.json(
      { error: "Choose an active class." },
      { status: 400 },
    );
  }

  if (student.current_class_id === classId) {
    return NextResponse.json(
      { error: "The student is already in this class." },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("students")
    .update({ current_class_id: classId, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Class change failed:", error.message);
    return NextResponse.json(
      { error: "Unable to change the class." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Class updated." });
}
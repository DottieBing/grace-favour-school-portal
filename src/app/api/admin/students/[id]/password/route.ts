import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { generateStudentPassword } from "@/lib/students/password";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
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

  const admin = createAdminClient();

  const { data: student, error: loadError } = await admin
    .from("students")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load student:", loadError.message);
    return NextResponse.json(
      { error: "Unable to load the student." },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  if (!student.user_id) {
    return NextResponse.json(
      { error: "This student has no login to reset." },
      { status: 400 },
    );
  }

  if (student.status !== "active") {
    return NextResponse.json(
      { error: "Reactivate the student before resetting the password." },
      { status: 400 },
    );
  }

  const password = generateStudentPassword();

  const { error } = await admin.auth.admin.updateUserById(
    student.user_id as string,
    { password },
  );

  if (error) {
    console.error("Password reset failed:", error.message);
    return NextResponse.json(
      { error: "Unable to reset the password." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { password },
    { headers: { "Cache-Control": "no-store" } },
  );
}
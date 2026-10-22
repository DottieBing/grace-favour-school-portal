import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  status: z.enum(["active", "withdrawn", "transferred", "graduated"]),
});

// About 100 years. Supabase has no permanent ban.
const BAN_DURATION = "876000h";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
  }

  let status: z.infer<typeof schema>["status"];

  try {
    const body: unknown = await request.json();
    status = schema.parse(body).status;
  } catch {
    return NextResponse.json(
      { error: "Choose a valid status." },
      { status: 400 },
    );
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

  if (student.status === status) {
    return NextResponse.json(
      { error: "The student already has this status." },
      { status: 409 },
    );
  }

  const { error: updateError } = await admin
    .from("students")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("Student status update failed:", updateError.message);
    return NextResponse.json(
      { error: "Unable to update the status." },
      { status: 500 },
    );
  }

  if (student.user_id) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      student.user_id as string,
      { ban_duration: status === "active" ? "none" : BAN_DURATION },
    );

    if (banError) {
      console.error("Auth ban update failed:", banError.message);

      await admin
        .from("students")
        .update({ status: student.status })
        .eq("id", id);

      return NextResponse.json(
        { error: "Unable to update the login. No changes were kept." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Status updated." });
}
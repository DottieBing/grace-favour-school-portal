import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ isActive: z.literal(false) });

// "Removing" an assignment deactivates it, so the history stays.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("classes", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid assignment id." },
      { status: 400 },
    );
  }

  try {
    const body: unknown = await request.json();
    schema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Assignments can only be removed here." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teacher_assignments")
    .update({ is_active: false, is_class_teacher: false })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Assignment removal failed:", error.message);
    return NextResponse.json(
      { error: "Unable to remove the assignment." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Assignment not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Assignment removed." });
}
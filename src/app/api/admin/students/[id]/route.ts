import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { readConfirm } from "@/lib/delete/confirm";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  // Deleting a student also deletes their payment history, so it is owner-only.
  const access = await getAccess("super_admin");

  if (!access.ok) return accessErrorResponse(access);

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
  }

  const confirm = await readConfirm(request);
  const admin = createAdminClient();

  const found = await admin
    .from("students")
    .select("admission_number")
    .eq("id", id)
    .maybeSingle();

  if (found.error) {
    console.error("Unable to load student:", found.error.message);
    return NextResponse.json({ error: "Unable to delete the student." }, { status: 500 });
  }

  if (!found.data) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  if (confirm !== found.data.admission_number) {
    return NextResponse.json(
      { error: "Type the admission number exactly to confirm." },
      { status: 400 },
    );
  }

  const { data, error } = await admin.rpc("delete_student_permanently", {
    p_student_id: id,
  });

  if (error) {
    console.error("Deleting the student failed:", error.message);
    return NextResponse.json(
      { error: "Unable to delete the student. Nothing was removed." },
      { status: 500 },
    );
  }

  const result = data as {
    user_id: string | null;
    photo_path: string | null;
    receipt_paths: string[];
  };

  if (result.photo_path) {
    const { error: photoError } = await admin.storage
      .from("student-photos")
      .remove([result.photo_path]);

    if (photoError) console.error("Removing the photo failed:", photoError.message);
  }

  if (result.receipt_paths.length > 0) {
    const { error: receiptError } = await admin.storage
      .from("fee-receipts")
      .remove(result.receipt_paths);

    if (receiptError) console.error("Removing receipts failed:", receiptError.message);
  }

  if (result.user_id) {
    const { error: loginError } = await admin.auth.admin.deleteUser(result.user_id);

    if (loginError) {
      console.error("Deleting the login failed:", loginError.message);
      return NextResponse.json(
        {
          error:
            "The student's records were deleted, but their login couldn't be removed. Delete it in Supabase under Authentication → Users.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Student deleted." });
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email address.")),
});

export async function PUT(request: Request) {
  const access = await getAccess("student");

  if (!access.ok) return accessErrorResponse(access);

  let email: string;

  try {
    email = schema.parse(await request.json()).email.toLowerCase();
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Enter a valid email address.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const student = await admin
    .from("students")
    .select("id")
    .eq("user_id", access.user.id)
    .maybeSingle();

  if (student.error || !student.data) {
    return NextResponse.json({ error: "Account not found." }, { status: 403 });
  }

  const links = await admin
    .from("student_guardians")
    .select("guardian_id, is_primary")
    .eq("student_id", student.data.id as string);

  if (links.error) {
    console.error("Unable to load the guardian:", links.error.message);
    return NextResponse.json({ error: "Unable to save the email." }, { status: 500 });
  }

  const link = (links.data ?? []).find((item) => item.is_primary) ?? (links.data ?? [])[0];

  if (!link) {
    return NextResponse.json({ error: "No guardian is linked to this account." }, { status: 404 });
  }

  // Saved as unverified. Verification by code arrives with the email service.
  const { error } = await admin
    .from("guardians")
    .update({ email, email_verified_at: null })
    .eq("id", link.guardian_id as string);

  if (error) {
    console.error("Saving the email failed:", error.message);
    return NextResponse.json({ error: "Unable to save the email." }, { status: 500 });
  }

  return NextResponse.json({ message: "Email saved." });
}
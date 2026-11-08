import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { consumeCode } from "@/lib/email/codes";
import { getStudentGuardian } from "@/lib/portal/guardian";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(request: Request) {
  const access = await getAccess("student");

  if (!access.ok) return accessErrorResponse(access);

  let code: string;

  try {
    code = schema.parse(await request.json()).code;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Enter the 6-digit code.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const found = await getStudentGuardian(admin, access.user.id);

  if (!found.ok) {
    return NextResponse.json({ error: found.message }, { status: found.status });
  }

  if (!found.email) {
    return NextResponse.json({ error: "Save your email address first." }, { status: 400 });
  }

  const result = await consumeCode(admin, {
    purpose: "verify_email",
    studentId: found.studentId,
    email: found.email,
    code,
  });

  if (result === "error") {
    return NextResponse.json({ error: "We couldn't check the code. Please try again." }, { status: 500 });
  }

  if (result !== "ok") {
    return NextResponse.json(
      {
        error:
          result === "locked"
            ? "Too many wrong attempts. Ask for a new code."
            : result === "expired"
              ? "That code has expired. Ask for a new one."
              : "That code isn't right.",
      },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("guardians")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", found.guardianId);

  if (error) {
    console.error("Marking the email verified failed:", error.message);
    return NextResponse.json({ error: "Unable to save the verification." }, { status: 500 });
  }

  return NextResponse.json({ message: "Email verified." });
}
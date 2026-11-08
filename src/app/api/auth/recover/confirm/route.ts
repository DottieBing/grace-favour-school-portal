import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeCode } from "@/lib/email/codes";
import { findRecoveryTarget, normalizeAdmission } from "@/lib/portal/guardian";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  admissionNumber: z.string().trim().min(5).max(30),
  code: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8, "The password must be at least 8 characters.").max(128),
});

const FAIL = "That code is incorrect or has expired. Ask for a new one.";

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;

  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const first = error instanceof z.ZodError ? error.issues[0] : null;

    return NextResponse.json(
      {
        error:
          first?.path[0] === "password" ? first.message : "Enter the admission number and the 6-digit code.",
      },
      { status: 400 },
    );
  }

  const admission = normalizeAdmission(input.admissionNumber);

  if (!admission) return NextResponse.json({ error: FAIL }, { status: 400 });

  const admin = createAdminClient();
  const target = await findRecoveryTarget(admin, admission);

  if (!target) return NextResponse.json({ error: FAIL }, { status: 400 });

  const result = await consumeCode(admin, {
    purpose: "reset_password",
    studentId: target.studentId,
    email: target.email,
    code: input.code,
  });

  if (result === "error") {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  if (result !== "ok") return NextResponse.json({ error: FAIL }, { status: 400 });

  const { error } = await admin.auth.admin.updateUserById(target.userId, {
    password: input.password,
  });

  if (error) {
    console.error("Resetting the password failed:", error.message);
    return NextResponse.json({ error: "We couldn't change the password. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ message: "Your password has been changed. You can sign in now." });
}
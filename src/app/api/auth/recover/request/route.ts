import { NextResponse } from "next/server";
import { z } from "zod";

import { codeEmail } from "@/lib/email/code-email";
import { CODE_MINUTES, issueCode } from "@/lib/email/codes";
import { sendEmail } from "@/lib/email/send";
import { findRecoveryTarget, normalizeAdmission } from "@/lib/portal/guardian";
import { getSchoolProfile } from "@/lib/settings/school";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ admissionNumber: z.string().trim().min(5).max(30) });

// The same reply every time, so nobody can find out which admission numbers exist.
const SAME_REPLY = {
  message:
    "If that admission number has a verified email, we've sent a code to it. Check your inbox.",
};

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;

  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter the admission number." }, { status: 400 });
  }

  const admission = normalizeAdmission(input.admissionNumber);

  if (!admission) return NextResponse.json(SAME_REPLY);

  const admin = createAdminClient();
  const target = await findRecoveryTarget(admin, admission);

  if (!target) return NextResponse.json(SAME_REPLY);

  const issued = await issueCode(admin, {
    purpose: "reset_password",
    studentId: target.studentId,
    email: target.email,
  });

  if (!issued.ok) return NextResponse.json(SAME_REPLY);

  const school = await getSchoolProfile();
  const mail = codeEmail({
    schoolName: school.name,
    heading: "Reset your password",
    intro: `Use this code to choose a new password for admission number ${admission}.`,
    code: issued.code,
    minutes: CODE_MINUTES,
  });

  await sendEmail({
    to: target.email,
    subject: `${issued.code} is your ${school.name} password reset code`,
    ...mail,
  });

  return NextResponse.json(SAME_REPLY);
}
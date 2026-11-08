import { NextResponse } from "next/server";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { codeEmail } from "@/lib/email/code-email";
import { CODE_MINUTES, issueCode } from "@/lib/email/codes";
import { sendEmail } from "@/lib/email/send";
import { getStudentGuardian } from "@/lib/portal/guardian";
import { getSchoolProfile } from "@/lib/settings/school";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const access = await getAccess("student");

  if (!access.ok) return accessErrorResponse(access);

  const admin = createAdminClient();
  const found = await getStudentGuardian(admin, access.user.id);

  if (!found.ok) {
    return NextResponse.json({ error: found.message }, { status: found.status });
  }

  if (!found.email) {
    return NextResponse.json({ error: "Save your email address first." }, { status: 400 });
  }

  if (found.verified) {
    return NextResponse.json({ error: "This email is already verified." }, { status: 409 });
  }

  const issued = await issueCode(admin, {
    purpose: "verify_email",
    studentId: found.studentId,
    email: found.email,
  });

  if (!issued.ok) {
    return NextResponse.json(
      {
        error:
          issued.reason === "rate"
            ? "You've asked for several codes. Please wait an hour and try again."
            : "We couldn't create a code. Please try again.",
      },
      { status: issued.reason === "rate" ? 429 : 500 },
    );
  }

  const school = await getSchoolProfile();
  const mail = codeEmail({
    schoolName: school.name,
    heading: "Verify your email",
    intro: "Enter this code on your Account page to confirm this email address.",
    code: issued.code,
    minutes: CODE_MINUTES,
  });

  const sent = await sendEmail({
    to: found.email,
    subject: `${issued.code} is your ${school.name} verification code`,
    ...mail,
  });

  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send the email. Check the address and try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ message: "Code sent." });
}
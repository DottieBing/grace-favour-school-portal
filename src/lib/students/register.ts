import "server-only";

import { admissionNumberToEmail } from "@/lib/auth/student-login";
import { generateStudentPassword } from "@/lib/students/password";
import type { ImportRow } from "@/lib/students/import-schema";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type RegisterOutcome =
  | { ok: true; admissionNumber: string; password: string }
  | { ok: false; error: string };

/** A leading symbol can be mangled when the login sheet is opened in Excel. */
function newPassword() {
  let password = generateStudentPassword();

  while (!/^[A-Za-z0-9]/.test(password)) {
    password = generateStudentPassword();
  }

  return password;
}

export async function registerOne(
  admin: Admin,
  row: ImportRow,
  grantedBy: string,
): Promise<RegisterOutcome> {
  const { data: admissionNumber, error: numberError } = await admin.rpc(
    "next_admission_number",
    { p_session_name: row.admissionSession },
  );

  if (numberError || typeof admissionNumber !== "string") {
    console.error("Admission number failed:", numberError?.message);
    return { ok: false, error: "Couldn't generate an admission number." };
  }

  const password = newPassword();
  const fullName = [row.firstName, row.middleName, row.lastName]
    .filter(Boolean)
    .join(" ");

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: admissionNumberToEmail(admissionNumber),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createError || !created.user) {
    console.error("Student login creation failed:", createError?.message);
    return { ok: false, error: "Couldn't create the student's login." };
  }

  const { error: registerError } = await admin.rpc("register_student", {
    p_user_id: created.user.id,
    p_granted_by: grantedBy,
    p_admission_number: admissionNumber,
    p_admission_session: row.admissionSession,
    p_first_name: row.firstName,
    p_middle_name: row.middleName,
    p_last_name: row.lastName,
    p_date_of_birth: row.dateOfBirth,
    p_gender: row.gender,
    p_admission_date: row.admissionDate,
    p_class_id: row.classId,
    p_guardian_name: row.guardianName,
    p_guardian_phone: row.guardianPhone,
    p_guardian_relationship: row.guardianRelationship,
  });

  if (registerError) {
    console.error("Student registration failed:", registerError.message);
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Couldn't save the student. Nothing was kept." };
  }

  return { ok: true, admissionNumber, password };
}
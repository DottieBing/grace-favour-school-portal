import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

type GuardianRow = { id: string; email: string | null; email_verified_at: string | null };

type Link = {
  is_primary: boolean;
  guardians: GuardianRow | GuardianRow[] | null;
};

function pick(links: Link[]) {
  const mapped = links.map((link) => ({
    primary: link.is_primary,
    guardian: Array.isArray(link.guardians) ? link.guardians[0] : link.guardians,
  }));

  return mapped.sort((a, b) => Number(b.primary) - Number(a.primary));
}

export type StudentGuardian =
  | {
      ok: true;
      studentId: string;
      guardianId: string;
      email: string | null;
      verified: boolean;
    }
  | { ok: false; status: number; message: string };

/** The signed-in student's primary guardian. */
export async function getStudentGuardian(
  admin: Admin,
  userId: string,
): Promise<StudentGuardian> {
  const student = await admin
    .from("students")
    .select("id, status, student_guardians(is_primary, guardians(id, email, email_verified_at))")
    .eq("user_id", userId)
    .maybeSingle();

  if (student.error) {
    console.error("Unable to load the student:", student.error.message);
    return { ok: false, status: 500, message: "Unable to check your account." };
  }

  if (!student.data || student.data.status !== "active") {
    return { ok: false, status: 403, message: "Account not found." };
  }

  const links = (student.data.student_guardians ?? []) as unknown as Link[];
  const chosen = pick(links).find((item) => item.guardian);

  if (!chosen?.guardian) {
    return { ok: false, status: 404, message: "No guardian is linked to this account." };
  }

  return {
    ok: true,
    studentId: student.data.id as string,
    guardianId: chosen.guardian.id,
    email: chosen.guardian.email,
    verified: Boolean(chosen.guardian.email_verified_at),
  };
}

export type RecoveryTarget = { studentId: string; userId: string; email: string };

/** A student who can recover their password: active, with a guardian email that is verified. */
export async function findRecoveryTarget(
  admin: Admin,
  admissionNumber: string,
): Promise<RecoveryTarget | null> {
  const { data, error } = await admin
    .from("students")
    .select(
      "id, user_id, status, student_guardians(is_primary, guardians(id, email, email_verified_at))",
    )
    .eq("admission_number", admissionNumber)
    .maybeSingle();

  if (error) {
    console.error("Unable to look up the student:", error.message);
    return null;
  }

  if (!data || data.status !== "active" || !data.user_id) return null;

  const links = (data.student_guardians ?? []) as unknown as Link[];
  const verified = pick(links).find(
    (item) => item.guardian?.email && item.guardian.email_verified_at,
  );

  if (!verified?.guardian?.email) return null;

  return {
    studentId: data.id as string,
    userId: data.user_id as string,
    email: verified.guardian.email,
  };
}

export function normalizeAdmission(input: string) {
  const value = input.replace(/\s+/g, "").toUpperCase();

  return /^[A-Z]{2,8}\d{7,}$/.test(value) ? value : null;
}
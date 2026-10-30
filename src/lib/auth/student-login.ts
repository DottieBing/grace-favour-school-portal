export const STUDENT_EMAIL_DOMAIN = "students.gfms.invalid";

// GFMS + 4-digit session code + 3 or more digits, like GFMS2627001.
const ADMISSION_PATTERN = /^[A-Z]{2,8}\d{7,}$/i;

/** The private sign-in email for a student's admission number. */
export function admissionNumberToEmail(admissionNumber: string) {
  return `${admissionNumber.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

/**
 * Turns what someone typed on the login form into the email Supabase needs.
 * Returns null when it is neither an email nor an admission number.
 */
export function resolveLoginIdentifier(input: string): string | null {
  const value = input.trim();

  if (value.includes("@")) {
    return value;
  }

  const compact = value.replace(/\s+/g, "");

  return ADMISSION_PATTERN.test(compact)
    ? admissionNumberToEmail(compact)
    : null;
}
import { z } from "zod";

import { normalizePhone } from "@/lib/students/phone";

export const TEMPLATE_HEADERS = [
  "First name",
  "Middle name",
  "Last name",
  "Date of birth",
  "Gender",
  "Admission session",
  "Admission date",
  "Class",
  "Guardian name",
  "Guardian phone",
  "Guardian relationship",
] as const;

export type RawKey =
  | "firstName"
  | "middleName"
  | "lastName"
  | "dateOfBirth"
  | "gender"
  | "admissionSession"
  | "admissionDate"
  | "className"
  | "guardianName"
  | "guardianPhone"
  | "guardianRelationship";

export type RawRecord = Record<RawKey, string>;

export const REQUIRED_KEYS: RawKey[] = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "admissionSession",
  "admissionDate",
  "className",
  "guardianName",
  "guardianPhone",
];

export function normalizeHeader(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const HEADER_KEYS: Record<string, RawKey> = {
  firstname: "firstName",
  middlename: "middleName",
  lastname: "lastName",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  gender: "gender",
  admissionsession: "admissionSession",
  admissiondate: "admissionDate",
  class: "className",
  guardianname: "guardianName",
  guardianphone: "guardianPhone",
  guardianrelationship: "guardianRelationship",
};

export function classKey(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The strict shape the batch route accepts. */
export const importRowSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    middleName: z.string().trim().max(60).nullable(),
    lastName: z.string().trim().min(1).max(60),
    dateOfBirth: z.string().date(),
    gender: z.enum(["male", "female"]).nullable(),
    admissionSession: z.string().regex(/^\d{4}\/\d{4}$/),
    admissionDate: z.string().date(),
    classId: z.uuid(),
    guardianName: z.string().trim().min(2).max(120),
    guardianPhone: z.string().regex(/^\+?\d{7,15}$/),
    guardianRelationship: z
      .enum(["Mother", "Father", "Guardian", "Other"])
      .nullable(),
  })
  .refine((value) => {
    const [from, to] = value.admissionSession.split("/").map(Number);
    return to === from + 1;
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export type PreviewRow = {
  rowNumber: number;
  name: string;
  className: string;
  row: ImportRow;
};

export type ValidationSummary = {
  total: number;
  ready: PreviewRow[];
  existing: { rowNumber: number; name: string }[];
  invalid: { rowNumber: number; name: string; errors: string[] }[];
};

export type BatchResult = {
  rowNumber: number;
  name: string;
  status: "created" | "skipped" | "failed";
  message?: string;
  admissionNumber?: string;
  password?: string;
};

/** Same name and date of birth means the same student. */
export function duplicateKey(row: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}) {
  return `${row.firstName.trim().toLowerCase()}|${row.lastName
    .trim()
    .toLowerCase()}|${row.dateOfBirth}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(text: string): string | null {
  const value = text.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);

    if (!local) return null;

    day = Number(local[1]);
    month = Number(local[2]);
    year = Number(local[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

const RELATIONSHIPS: Record<string, "Mother" | "Father" | "Guardian" | "Other"> = {
  mother: "Mother",
  father: "Father",
  guardian: "Guardian",
  other: "Other",
};

/** Turns one spreadsheet row into a strict row, or a list of friendly errors. */
export function validateRawRow(
  raw: RawRecord,
  classes: Map<string, { id: string; name: string }>,
): { ok: true; row: ImportRow; className: string } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const firstName = raw.firstName.trim();
  const lastName = raw.lastName.trim();

  if (!firstName) errors.push("First name is missing.");
  if (!lastName) errors.push("Last name is missing.");

  let dateOfBirth = "";

  if (!raw.dateOfBirth.trim()) {
    errors.push("Date of birth is missing.");
  } else {
    const parsed = parseDate(raw.dateOfBirth);

    if (!parsed) errors.push("Date of birth isn't a valid date (use 2019-04-12).");
    else if (parsed > today) errors.push("Date of birth is in the future.");
    else dateOfBirth = parsed;
  }

  let gender: "male" | "female" | null = null;
  const genderText = raw.gender.trim().toLowerCase();

  if (genderText) {
    if (genderText === "male" || genderText === "m") gender = "male";
    else if (genderText === "female" || genderText === "f") gender = "female";
    else errors.push("Gender must be Male or Female.");
  }

  const admissionSession = raw.admissionSession.trim();
  const sessionMatch = /^(\d{4})\/(\d{4})$/.exec(admissionSession);

  if (!sessionMatch) {
    errors.push("Admission session must look like 2026/2027.");
  } else if (Number(sessionMatch[2]) !== Number(sessionMatch[1]) + 1) {
    errors.push("Admission session years must follow each other, like 2026/2027.");
  }

  let admissionDate = "";

  if (!raw.admissionDate.trim()) {
    errors.push("Admission date is missing.");
  } else {
    const parsed = parseDate(raw.admissionDate);

    if (!parsed) errors.push("Admission date isn't a valid date (use 2023-09-11).");
    else admissionDate = parsed;
  }

  const matchedClass = raw.className.trim()
    ? classes.get(classKey(raw.className))
    : undefined;

  if (!raw.className.trim()) errors.push("Class is missing.");
  else if (!matchedClass) errors.push(`Class "${raw.className.trim()}" wasn't found.`);

  const guardianName = raw.guardianName.trim();

  if (guardianName.length < 2) errors.push("Guardian name is missing.");

  // Spreadsheets often drop the leading zero from phone numbers.
  let phoneText = raw.guardianPhone.trim();

  if (/^[789]\d{9}$/.test(phoneText)) phoneText = `0${phoneText}`;

  const guardianPhone = phoneText ? normalizePhone(phoneText) : null;

  if (!phoneText) errors.push("Guardian phone is missing.");
  else if (!guardianPhone) errors.push("Guardian phone isn't a valid number.");

  let guardianRelationship: ImportRow["guardianRelationship"] = null;
  const relationshipText = raw.guardianRelationship.trim().toLowerCase();

  if (relationshipText) {
    guardianRelationship = RELATIONSHIPS[relationshipText] ?? null;

    if (!guardianRelationship) {
      errors.push("Relationship must be Mother, Father, Guardian or Other.");
    }
  }

  if (errors.length > 0 || !matchedClass || !guardianPhone) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    className: matchedClass.name,
    row: {
      firstName,
      middleName: raw.middleName.trim() || null,
      lastName,
      dateOfBirth,
      gender,
      admissionSession,
      admissionDate,
      classId: matchedClass.id,
      guardianName,
      guardianPhone,
      guardianRelationship,
    },
  };
}
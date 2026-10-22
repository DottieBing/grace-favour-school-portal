import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { admissionNumberToEmail } from "@/lib/auth/student-login";
import { normalizePhone } from "@/lib/students/phone";
import { createAdminClient } from "@/lib/supabase/admin";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function generatePassword(length = 12) {
  return Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join("");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Enter the first name.").max(60),
    middleName: optionalText(60),
    lastName: z.string().trim().min(1, "Enter the last name.").max(60),
    dateOfBirth: z
      .union([z.string().date("Enter a valid date of birth."), z.literal("")])
      .transform((value) => (value === "" ? null : value)),
    gender: z
      .enum(["male", "female", ""])
      .transform((value) => (value === "" ? null : value)),
    admissionSession: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Use the session format 2026/2027."),
    admissionDate: z.string().date("Enter a valid admission date."),
    classId: z.uuid("Choose a class."),
    guardianName: z.string().trim().min(2, "Enter the guardian's name.").max(120),
    guardianPhone: z.string().trim().min(1, "Enter the guardian's phone."),
    guardianRelationship: z.enum(["Mother", "Father", "Guardian", "Other", ""]).transform(
      (value) => (value === "" ? null : value),
    ),
  })
  .superRefine((value, ctx) => {
    const [from, to] = value.admissionSession.split("/").map(Number);

    if (to !== from + 1) {
      ctx.addIssue({
        code: "custom",
        path: ["admissionSession"],
        message: "The second year must follow the first, like 2026/2027.",
      });
    }
  });

export async function POST(request: Request) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid student details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const phone = normalizePhone(input.guardianPhone);

  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid guardian phone number." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("id, is_active")
    .eq("id", input.classId)
    .maybeSingle();

  if (classError) {
    console.error("Unable to load class:", classError.message);
    return NextResponse.json(
      { error: "Unable to load the class." },
      { status: 500 },
    );
  }

  if (!cls || !cls.is_active) {
    return NextResponse.json(
      { error: "Choose an active class." },
      { status: 400 },
    );
  }

  // 1. Issue the admission number (safe against simultaneous registrations).
  const { data: admissionNumber, error: numberError } = await admin.rpc(
    "next_admission_number",
    { p_session_name: input.admissionSession },
  );

  if (numberError || typeof admissionNumber !== "string") {
    console.error("Admission number failed:", numberError?.message);
    return NextResponse.json(
      { error: "Unable to generate an admission number." },
      { status: 500 },
    );
  }

  // 2. Create the login. The student signs in with the admission number.
  const password = generatePassword();
  const fullName = [input.firstName, input.middleName, input.lastName]
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
    return NextResponse.json(
      { error: "Unable to create the student's login." },
      { status: 500 },
    );
  }

  const userId = created.user.id;

  // 3. Create everything else in one transaction.
  const { data: result, error: registerError } = await admin.rpc(
    "register_student",
    {
      p_user_id: userId,
      p_granted_by: access.user.id,
      p_admission_number: admissionNumber,
      p_admission_session: input.admissionSession,
      p_first_name: input.firstName,
      p_middle_name: input.middleName,
      p_last_name: input.lastName,
      p_date_of_birth: input.dateOfBirth,
      p_gender: input.gender,
      p_admission_date: input.admissionDate,
      p_class_id: input.classId,
      p_guardian_name: input.guardianName,
      p_guardian_phone: phone,
      p_guardian_relationship: input.guardianRelationship,
    },
  );

  if (registerError) {
    console.error("Student registration failed:", registerError.message);

    // Remove the login so nothing is left half-created.
    await admin.auth.admin.deleteUser(userId);

    return NextResponse.json(
      { error: "Unable to register the student. Nothing was saved." },
      { status: 500 },
    );
  }

  const details = result as {
    student_id: string;
    guardian_name: string;
    guardian_reused: boolean;
  };

  return NextResponse.json(
    {
      studentId: details.student_id,
      admissionNumber,
      password,
      studentName: fullName,
      guardianName: details.guardian_name,
      guardianReused: details.guardian_reused,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
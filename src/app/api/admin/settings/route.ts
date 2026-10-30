import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

const schema = z.object({
  name: z.string().trim().min(2, "Enter the school name.").max(120),
  motto: optional(120),
  address: optional(250),
  phone: optional(40),
  email: z
    .union([z.literal(""), z.string().trim().pipe(z.email("Enter a valid email."))])
    .transform((value) => (value === "" ? null : value)),
  website: optional(200),
  admissionPrefix: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2,8}$/, "The prefix must be 2 to 8 letters.")),
  timetableDays: z
    .array(z.number().int().min(1).max(7))
    .min(1, "Choose at least one school day for the timetable."),
  teacherClashCheck: z.boolean(),
});

export async function PUT(request: Request) {
  const access = await getAccess("super_admin");

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
        ? (error.issues[0]?.message ?? "Invalid settings.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("school_settings").upsert({
    id: true,
    name: input.name,
    motto: input.motto,
    address: input.address,
    phone: input.phone,
    email: input.email,
    website: input.website,
    admission_prefix: input.admissionPrefix,
    timetable_days: [...new Set(input.timetableDays)].sort((a, b) => a - b),
    teacher_clash_check: input.teacherClashCheck,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Saving settings failed:", error.message);
    return NextResponse.json(
      { error: "Unable to save the settings." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Settings saved." });
}
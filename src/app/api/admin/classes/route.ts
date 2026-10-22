import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkArmRules } from "@/lib/academic/classes";
import { buildClassName } from "@/lib/academic/levels";

const schema = z.object({
  levelNumber: z.number().int().min(1).max(8),
  section: z
    .string()
    .trim()
    .regex(/^[A-Za-z]?$/, "The arm must be a single letter, like A or B.")
    .transform((value) => (value === "" ? null : value.toUpperCase())),
  capacity: z
    .number()
    .int()
    .min(1, "Capacity must be at least 1.")
    .max(200, "Capacity can't be more than 200.")
    .nullable(),
});

export async function POST(request: Request) {
  const access = await getAdminAccess("classes", "manage");

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
        ? (error.issues[0]?.message ?? "Invalid class details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const armProblem = await checkArmRules(
    admin,
    input.levelNumber,
    input.section,
  );

  if (armProblem) {
    return NextResponse.json(
      { error: armProblem.message },
      { status: armProblem.status },
    );
  }

  const { error } = await admin.from("classes").insert({
    name: buildClassName(input.levelNumber, input.section),
    level_number: input.levelNumber,
    section: input.section,
    capacity: input.capacity,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This class already exists." },
        { status: 409 },
      );
    }

    console.error("Class creation failed:", error.message);

    return NextResponse.json(
      { error: "Unable to create the class." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Class created." }, { status: 201 });
}
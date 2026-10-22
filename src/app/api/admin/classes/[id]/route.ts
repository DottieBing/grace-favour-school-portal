import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkArmRules } from "@/lib/academic/classes";
import { buildClassName } from "@/lib/academic/levels";

const schema = z.object({
  section: z
    .string()
    .trim()
    .regex(/^[A-Za-z]?$/, "The arm must be a single letter, like A or B.")
    .transform((value) => (value === "" ? null : value.toUpperCase()))
    .optional(),
  capacity: z
    .number()
    .int()
    .min(1, "Capacity must be at least 1.")
    .max(200, "Capacity can't be more than 200.")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("classes", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
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

  const { data: existing, error: loadError } = await admin
    .from("classes")
    .select("id, level_number, section, is_active")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load class:", loadError.message);
    return NextResponse.json(
      { error: "Unable to load the class." },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const update: Record<string, string | number | boolean | null> = {};

  if (input.section !== undefined) {
    const armProblem = await checkArmRules(
      admin,
      existing.level_number as number,
      input.section,
      id,
    );

    if (armProblem) {
      return NextResponse.json(
        { error: armProblem.message },
        { status: armProblem.status },
      );
    }

    update.section = input.section;
    update.name = buildClassName(existing.level_number as number, input.section);
  }

  if (input.capacity !== undefined) {
    update.capacity = input.capacity;
  }

  if (input.isActive !== undefined && input.isActive !== existing.is_active) {
    if (!input.isActive) {
      const { count, error: countError } = await admin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("current_class_id", id)
        .eq("status", "active");

      if (countError) {
        console.error("Unable to count students:", countError.message);
        return NextResponse.json(
          { error: "Unable to check the class's students." },
          { status: 500 },
        );
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error: `This class still has ${count} active student${
              count === 1 ? "" : "s"
            }. Move them to another class first.`,
          },
          { status: 409 },
        );
      }
    }

    update.is_active = input.isActive;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "There is nothing to change." },
      { status: 400 },
    );
  }

  const { error: updateError } = await admin
    .from("classes")
    .update(update)
    .eq("id", id);

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "A class with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Class update failed:", updateError.message);

    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Class updated." });
}
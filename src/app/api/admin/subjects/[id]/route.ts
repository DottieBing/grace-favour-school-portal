import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the subject name.")
    .max(80)
    .optional(),
  code: z
    .string()
    .trim()
    .max(10, "The code can be at most 10 characters.")
    .transform((value) => (value === "" ? null : value.toUpperCase()))
    .optional(),
  description: z
    .string()
    .trim()
    .max(300, "The description can be at most 300 characters.")
    .transform((value) => (value === "" ? null : value))
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid subject id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid subject details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const update: Record<string, string | boolean | null> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.code !== undefined) update.code = input.code;
  if (input.description !== undefined) update.description = input.description;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "There is nothing to change." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("subjects")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A subject with this name or code already exists." },
        { status: 409 },
      );
    }

    console.error("Subject update failed:", error.message);

    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Subject not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Subject updated." });
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(40).optional(),
  maxScore: z
    .number()
    .positive("The maximum score must be more than 0.")
    .max(1000, "The maximum score can't be more than 1000.")
    .refine((value) => Math.round(value * 100) / 100 === value, {
      message: "Use at most two decimal places.",
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("grading", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid component id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const update: Record<string, string | number | boolean> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.maxScore !== undefined) update.max_score = input.maxScore;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "There is nothing to change." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (input.maxScore !== undefined) {
    const { data: current, error: currentError } = await admin
      .from("assessment_components")
      .select("max_score")
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      console.error("Unable to load component:", currentError.message);
      return NextResponse.json(
        { error: "Unable to save the changes." },
        { status: 500 },
      );
    }

    if (!current) {
      return NextResponse.json(
        { error: "Component not found." },
        { status: 404 },
      );
    }

    if (Number(current.max_score) !== input.maxScore) {
      const { count, error: countError } = await admin
        .from("result_scores")
        .select("id", { count: "exact", head: true })
        .eq("component_id", id);

      if (countError) {
        console.error("Unable to check scores:", countError.message);
        return NextResponse.json(
          { error: "Unable to save the changes." },
          { status: 500 },
        );
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "Scores already use this component, so its maximum can't change. Deactivate it and add a new one instead.",
          },
          { status: 409 },
        );
      }
    }
  }

  const { data, error } = await admin
    .from("assessment_components")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A component with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Component update failed:", error.message);

    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Component not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Component updated." });
}
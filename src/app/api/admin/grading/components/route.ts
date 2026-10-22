import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(40),
  maxScore: z
    .number()
    .positive("The maximum score must be more than 0.")
    .max(1000, "The maximum score can't be more than 1000.")
    .refine((value) => Math.round(value * 100) / 100 === value, {
      message: "Use at most two decimal places.",
    }),
});

export async function POST(request: Request) {
  const access = await getAdminAccess("grading", "manage");

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
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: last, error: lastError } = await admin
    .from("assessment_components")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (lastError) {
    console.error("Unable to read components:", lastError.message);
    return NextResponse.json(
      { error: "Unable to save the component." },
      { status: 500 },
    );
  }

  const nextOrder = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1;

  const { error } = await admin.from("assessment_components").insert({
    name: input.name,
    max_score: input.maxScore,
    sort_order: nextOrder,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A component with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Component creation failed:", error.message);

    return NextResponse.json(
      { error: "Unable to save the component." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Component added." }, { status: 201 });
}
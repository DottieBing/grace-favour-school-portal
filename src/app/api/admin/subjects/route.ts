import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the subject name.").max(80),
  code: z
    .string()
    .trim()
    .max(10, "The code can be at most 10 characters.")
    .transform((value) => (value === "" ? null : value.toUpperCase())),
  description: z
    .string()
    .trim()
    .max(300, "The description can be at most 300 characters.")
    .transform((value) => (value === "" ? null : value)),
});

export async function POST(request: Request) {
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
        ? (error.issues[0]?.message ?? "Invalid subject details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("subjects").insert({
    name: input.name,
    code: input.code,
    description: input.description,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A subject with this name or code already exists." },
        { status: 409 },
      );
    }

    console.error("Subject creation failed:", error.message);

    return NextResponse.json(
      { error: "Unable to create the subject." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Subject created." }, { status: 201 });
}
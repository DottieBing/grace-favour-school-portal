import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the item name.").max(60),
  description: z
    .string()
    .trim()
    .max(200, "The description can be at most 200 characters.")
    .transform((value) => (value === "" ? null : value)),
});

export async function POST(request: Request) {
  const access = await getAdminAccess("fees", "manage");

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

  const { error } = await admin.from("fee_items").insert({
    name: input.name,
    description: input.description,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A fee item with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Fee item creation failed:", error.message);

    return NextResponse.json(
      { error: "Unable to create the item." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Item created." }, { status: 201 });
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { permissionsSchema } from "@/lib/users/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a template name.").max(60),
  permissions: permissionsSchema,
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
        ? (error.issues[0]?.message ?? "Invalid template.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("permission_templates").insert({
    name: input.name,
    permissions: input.permissions,
    created_by: access.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A template with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Template creation failed:", error.message);

    return NextResponse.json(
      { error: "Unable to save the template." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Template saved." }, { status: 201 });
}
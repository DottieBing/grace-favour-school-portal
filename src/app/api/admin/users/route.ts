import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { generateStudentPassword } from "@/lib/students/password";
import { jobTitleSchema, permissionsSchema } from "@/lib/users/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name.").max(120),
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
  jobTitle: jobTitleSchema,
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
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const email = input.email.toLowerCase();
  const password = generateStudentPassword(14);

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

  if (createError || !created.user) {
    const message = createError?.message ?? "";

    if (
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("registered")
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    console.error("User creation failed:", message);

    return NextResponse.json(
      { error: "Unable to create the user." },
      { status: 500 },
    );
  }

  const userId = created.user.id;

  // Deleting the login also removes everything below, so a failure leaves nothing behind.
  async function rollback(reason: string, detail: string) {
    console.error(reason, detail);
    await admin.auth.admin.deleteUser(userId);

    return NextResponse.json(
      { error: "Unable to create the user. Nothing was saved." },
      { status: 500 },
    );
  }

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "admin_user",
    granted_by: access.user.id,
  });

  if (roleError) return rollback("Role creation failed:", roleError.message);

  const { error: profileError } = await admin.from("admin_users").insert({
    user_id: userId,
    job_title: input.jobTitle,
    created_by: access.user.id,
  });

  if (profileError) return rollback("Admin user failed:", profileError.message);

  const { error: permissionError } = await admin.rpc("save_admin_permissions", {
    p_user_id: userId,
    p_permissions: input.permissions,
  });

  if (permissionError) {
    return rollback("Saving permissions failed:", permissionError.message);
  }

  return NextResponse.json(
    { userId, email, password },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
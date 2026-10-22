import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { jobTitleSchema, permissionsSchema } from "@/lib/users/schema";
import { checkAdminUser } from "@/lib/users/target";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  jobTitle: jobTitleSchema,
  permissions: permissionsSchema,
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
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
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
  const problem = await checkAdminUser(admin, id, access.user.id);

  if (problem) {
    return NextResponse.json({ error: problem.message }, { status: problem.status });
  }

  const { error: titleError } = await admin
    .from("admin_users")
    .update({ job_title: input.jobTitle })
    .eq("user_id", id);

  if (titleError) {
    console.error("Job title update failed:", titleError.message);
    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  const { error } = await admin.rpc("save_admin_permissions", {
    p_user_id: id,
    p_permissions: input.permissions,
  });

  if (error) {
    console.error("Saving permissions failed:", error.message);
    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Access updated." });
}
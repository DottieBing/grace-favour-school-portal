import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { jobTitleSchema, permissionsSchema } from "@/lib/users/schema";
import { checkAdminUser } from "@/lib/users/target";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfirm } from "@/lib/delete/confirm";

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

export async function DELETE(
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

  const confirm = (await readConfirm(request)).toLowerCase();
  const admin = createAdminClient();
  const problem = await checkAdminUser(admin, id, access.user.id);

  if (problem) {
    return NextResponse.json({ error: problem.message }, { status: problem.status });
  }

  const [profile, staff] = await Promise.all([
    admin.from("profiles").select("email").eq("id", id).maybeSingle(),
    admin.from("staff").select("id").eq("user_id", id).maybeSingle(),
  ]);

  if (profile.error || staff.error) {
    console.error("Unable to load user:", profile.error?.message ?? staff.error?.message);
    return NextResponse.json({ error: "Unable to delete the user." }, { status: 500 });
  }

  if (staff.data) {
    return NextResponse.json(
      { error: "This login belongs to a staff record. Delete the staff record instead." },
      { status: 409 },
    );
  }

  const email = ((profile.data?.email as string | null) ?? "").toLowerCase();

  if (email === "" || confirm !== email) {
    return NextResponse.json(
      { error: "Type the user's email exactly to confirm." },
      { status: 400 },
    );
  }

  // Removing the login also removes their role, access ticks and profile.
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    console.error("Deleting the user failed:", error.message);
    return NextResponse.json({ error: "Unable to delete the user." }, { status: 500 });
  }

  return NextResponse.json({ message: "User deleted." });
}
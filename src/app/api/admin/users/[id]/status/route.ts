import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { checkAdminUser } from "@/lib/users/target";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ isActive: z.boolean() });

// About 100 years. Supabase has no permanent ban.
const BAN_DURATION = "876000h";

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

  let isActive: boolean;

  try {
    const body: unknown = await request.json();
    isActive = schema.parse(body).isActive;
  } catch {
    return NextResponse.json(
      { error: "The request must include a true or false isActive value." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const problem = await checkAdminUser(admin, id, access.user.id);

  if (problem) {
    return NextResponse.json({ error: problem.message }, { status: problem.status });
  }

  const { data: profile, error: loadError } = await admin
    .from("profiles")
    .select("is_active")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !profile) {
    console.error("Unable to load profile:", loadError?.message);
    return NextResponse.json(
      { error: "Unable to load the user." },
      { status: 500 },
    );
  }

  const previous = profile.is_active as boolean;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);

  if (updateError) {
    console.error("Status update failed:", updateError.message);
    return NextResponse.json(
      { error: "Unable to update the user." },
      { status: 500 },
    );
  }

  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? "none" : BAN_DURATION,
  });

  if (banError) {
    console.error("Auth ban update failed:", banError.message);

    await admin.from("profiles").update({ is_active: previous }).eq("id", id);

    return NextResponse.json(
      { error: "Unable to update the login. No changes were kept." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: isActive ? "User reactivated." : "User deactivated." });
}
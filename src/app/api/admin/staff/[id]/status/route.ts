import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.uuid();
const bodySchema = z.object({ isActive: z.boolean() });

// About 100 years. Supabase has no permanent ban, so this is the standard approach.
const BAN_DURATION = "876000h";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
    // 1 and 2. Verify the requester is an active Super Admin.
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const user = access.user;

  // 3. Validate the staff id and the request body.
  const { id } = await context.params;

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
  }

  let isActive: boolean;

  try {
    const body: unknown = await request.json();
    isActive = bodySchema.parse(body).isActive;
  } catch {
    return NextResponse.json(
      { error: "The request must include a true or false isActive value." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 4. Load the staff record.
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, user_id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (staffError) {
    console.error("Unable to load staff record:", staffError.message);
    return NextResponse.json(
      { error: "Unable to load the staff record." },
      { status: 500 },
    );
  }

  if (!staff) {
    return NextResponse.json(
      { error: "Staff record not found." },
      { status: 404 },
    );
  }

  if (staff.is_active === isActive) {
    return NextResponse.json(
      {
        error: isActive
          ? "This staff member is already active."
          : "This staff member is already inactive.",
      },
      { status: 409 },
    );
  }

  // 5. Safety rules for staff who have a login.
  if (staff.user_id) {
    if (staff.user_id === user.id) {
      return NextResponse.json(
        { error: "You can't change the status of your own account." },
        { status: 400 },
      );
    }

    const { data: targetRoles, error: targetRoleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", staff.user_id);

    if (targetRoleError) {
      console.error("Unable to check target roles:", targetRoleError.message);
      return NextResponse.json(
        { error: "Unable to verify this account's role." },
        { status: 500 },
      );
    }

    if (targetRoles?.some((item) => item.role === "super_admin")) {
      return NextResponse.json(
        { error: "Super Admin accounts can't be changed from this screen." },
        { status: 403 },
      );
    }
  }

  // 6. Update the staff flag.
  const { error: updateError } = await admin
    .from("staff")
    .update({ is_active: isActive })
    .eq("id", staff.id);

  if (updateError) {
    console.error("Staff status update failed:", updateError.message);
    return NextResponse.json(
      { error: "Unable to update the staff status." },
      { status: 500 },
    );
  }

  // 7. Ban or unban the login. If this fails, put the flag back.
  if (staff.user_id) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      staff.user_id,
      { ban_duration: isActive ? "none" : BAN_DURATION },
    );

    if (banError) {
      console.error("Auth ban update failed:", banError.message);

      const { error: revertError } = await admin
        .from("staff")
        .update({ is_active: staff.is_active })
        .eq("id", staff.id);

      if (revertError) {
        console.error("Status rollback failed:", revertError.message);
      }

      return NextResponse.json(
        { error: "Unable to update the login. No changes were kept." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: isActive ? "Staff reactivated." : "Staff deactivated.",
    isActive,
  });
}
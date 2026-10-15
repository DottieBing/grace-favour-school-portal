import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function generatePassword(length = 16) {
  return Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join("");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: staff, error: loadError } = await admin
    .from("staff")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load staff record:", loadError.message);
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

  if (!staff.user_id) {
    return NextResponse.json(
      { error: "This staff member has no login to reset." },
      { status: 400 },
    );
  }

  if (staff.user_id === access.user.id) {
    return NextResponse.json(
      { error: "You can't reset your own password from this screen." },
      { status: 400 },
    );
  }

  const { data: targetRoles, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", staff.user_id);

  if (roleError) {
    console.error("Unable to check target roles:", roleError.message);
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

  const password = generatePassword();

  const { error: updateError } = await admin.auth.admin.updateUserById(
    staff.user_id,
    { password },
  );

  if (updateError) {
    console.error("Password reset failed:", updateError.message);
    return NextResponse.json(
      { error: "Unable to reset the password." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { password },
    { headers: { "Cache-Control": "no-store" } },
  );
}
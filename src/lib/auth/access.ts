import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccessResult =
  | { ok: true; user: User; roles: string[] }
  | {
      ok: false;
      reason: "unauthenticated" | "inactive" | "forbidden" | "error";
    };

/**
 * Checks that the requester is signed in, has the required role, and
 * does not have an inactive staff record.
 */
export async function getAccess(requiredRole: string): Promise<AccessResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    console.error("Unable to verify account permissions:", roleError.message);
    return { ok: false, reason: "error" };
  }

  const admin = createAdminClient();

  const { data: staffRows, error: staffError } = await admin
    .from("staff")
    .select("is_active")
    .eq("user_id", user.id);

  if (staffError) {
    console.error("Unable to verify staff status:", staffError.message);
    return { ok: false, reason: "error" };
  }

  if (staffRows?.some((row) => !row.is_active)) {
    return { ok: false, reason: "inactive" };
  }

  const roles = (roleRows ?? []).map((item) => item.role as string);

  if (!roles.includes(requiredRole)) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, user, roles };
}

/** For server-rendered pages and layouts: redirects when access is denied. */
export async function requirePageAccess(requiredRole: string) {
  const access = await getAccess(requiredRole);

  if (!access.ok) {
    if (access.reason === "error") {
      throw new Error("Unable to verify your school permissions.");
    }

    redirect(access.reason === "unauthenticated" ? "/login" : "/unauthorized");
  }

  return access;
}

/** For API routes: turns a denied result into a JSON response. */
export function accessErrorResponse(
  access: Extract<AccessResult, { ok: false }>,
) {
  switch (access.reason) {
    case "unauthenticated":
      return NextResponse.json(
        { error: "You must sign in to perform this action." },
        { status: 401 },
      );
    case "inactive":
      return NextResponse.json(
        { error: "Your account is inactive." },
        { status: 403 },
      );
    case "forbidden":
      return NextResponse.json(
        { error: "You are not authorized to perform this action." },
        { status: 403 },
      );
    default:
      return NextResponse.json(
        { error: "Unable to verify your permissions." },
        { status: 500 },
      );
  }
}
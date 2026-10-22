import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allows,
  isArea,
  ownerPermissions,
  type Area,
  type Level,
  type Permissions,
} from "@/lib/auth/permissions";

export type DenyReason = "unauthenticated" | "inactive" | "forbidden" | "error";
export type Denied = { ok: false; reason: DenyReason };

export type AccessResult =
  | { ok: true; user: User; roles: string[] }
  | Denied;

export type AdminSessionResult =
  | { ok: true; user: User; isOwner: boolean; permissions: Permissions }
  | Denied;

type Identity = { ok: true; user: User; roles: string[] } | Denied;

/** Signed in, not deactivated, and their roles. */
async function getIdentity(): Promise<Identity> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const admin = createAdminClient();

  const [rolesResult, staffResult, profileResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    admin.from("staff").select("is_active").eq("user_id", user.id),
    admin.from("profiles").select("is_active").eq("id", user.id).maybeSingle(),
  ]);

  const failure =
    rolesResult.error ?? staffResult.error ?? profileResult.error;

  if (failure) {
    console.error("Unable to verify account permissions:", failure.message);
    return { ok: false, reason: "error" };
  }

  if (
    staffResult.data?.some((row) => !row.is_active) ||
    profileResult.data?.is_active === false
  ) {
    return { ok: false, reason: "inactive" };
  }

  return {
    ok: true,
    user,
    roles: (rolesResult.data ?? []).map((item) => item.role as string),
  };
}

/** For teachers, students and other single-role checks. */
export async function getAccess(requiredRole: string): Promise<AccessResult> {
  const identity = await getIdentity();

  if (!identity.ok) return identity;

  if (!identity.roles.includes(requiredRole)) {
    return { ok: false, reason: "forbidden" };
  }

  return identity;
}

async function loadPermissions(userId: string): Promise<Permissions | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("admin_permissions")
    .select("area, level")
    .eq("user_id", userId);

  if (error) {
    console.error("Unable to load permissions:", error.message);
    return null;
  }

  const result: Permissions = {};

  for (const row of data ?? []) {
    if (isArea(row.area) && (row.level === "view" || row.level === "manage")) {
      result[row.area] = row.level;
    }
  }

  return result;
}

/** The owner (full access) or an owner-created staff user (ticked access). */
export async function getAdminSession(): Promise<AdminSessionResult> {
  const identity = await getIdentity();

  if (!identity.ok) return identity;

  if (identity.roles.includes("super_admin")) {
    return {
      ok: true,
      user: identity.user,
      isOwner: true,
      permissions: ownerPermissions(),
    };
  }

  if (identity.roles.includes("admin_user")) {
    const permissions = await loadPermissions(identity.user.id);

    if (!permissions) return { ok: false, reason: "error" };

    return { ok: true, user: identity.user, isOwner: false, permissions };
  }

  return { ok: false, reason: "forbidden" };
}

/** For API routes: may this person view or manage this area? */
export async function getAdminAccess(
  area: Area,
  level: Level,
): Promise<AdminSessionResult> {
  const session = await getAdminSession();

  if (!session.ok) return session;

  if (!allows(session.permissions, area, level)) {
    return { ok: false, reason: "forbidden" };
  }

  return session;
}

function denyPage(reason: DenyReason): never {
  if (reason === "error") {
    throw new Error("Unable to verify your school permissions.");
  }

  redirect(reason === "unauthenticated" ? "/login" : "/unauthorized");
}

/** For server-rendered pages and layouts with a single required role. */
export async function requirePageAccess(requiredRole: string) {
  const access = await getAccess(requiredRole);

  if (!access.ok) denyPage(access.reason);

  return access;
}

/** For the admin layout and dashboard: any admin user. */
export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session.ok) denyPage(session.reason);

  return session;
}

/** For admin pages: redirects unless the person may open this area. */
export async function requireAreaAccess(area: Area, level: Level = "view") {
  const session = await getAdminAccess(area, level);

  if (!session.ok) denyPage(session.reason);

  return {
    ...session,
    canManage: allows(session.permissions, area, "manage"),
  };
}

/** For API routes: turns a denied result into a JSON response. */
export function accessErrorResponse(access: Denied) {
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
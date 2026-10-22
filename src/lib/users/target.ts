import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Makes sure the target is an owner-created user, never the owner or yourself. */
export async function checkAdminUser(
  admin: Admin,
  targetId: string,
  actorId: string,
): Promise<{ status: number; message: string } | null> {
  if (targetId === actorId) {
    return { status: 400, message: "You can't change your own account here." };
  }

  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetId);

  if (error) {
    console.error("Unable to check the user's role:", error.message);
    return { status: 500, message: "Unable to verify this user." };
  }

  const roles = (data ?? []).map((item) => item.role as string);

  if (roles.includes("super_admin")) {
    return { status: 403, message: "The owner account can't be changed here." };
  }

  if (!roles.includes("admin_user")) {
    return { status: 404, message: "User not found." };
  }

  return null;
}
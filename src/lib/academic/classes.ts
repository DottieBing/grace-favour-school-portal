import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { levelLabel } from "@/lib/academic/levels";

type Admin = ReturnType<typeof createAdminClient>;

export async function checkArmRules(
  admin: Admin,
  levelNumber: number,
  section: string | null,
  excludeId?: string,
): Promise<{ status: number; message: string } | null> {
  let query = admin
    .from("classes")
    .select("id, section")
    .eq("level_number", levelNumber);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Unable to check existing classes:", error.message);
    return { status: 500, message: "Unable to check existing classes." };
  }

  const others = data ?? [];
  const label = levelLabel(levelNumber);

  if (section && others.some((item) => !item.section)) {
    return {
      status: 409,
      message: `${label} already exists without an arm. Give that class an arm letter first.`,
    };
  }

  if (!section && others.some((item) => item.section)) {
    return {
      status: 409,
      message: `${label} already has arms. Enter an arm letter.`,
    };
  }

  return null;
}
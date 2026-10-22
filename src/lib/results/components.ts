import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ScoreComponent } from "@/lib/results/types";

type Admin = ReturnType<typeof createAdminClient>;

/** The score components currently in use, or null if the lookup fails. */
export async function loadActiveComponents(
  admin: Admin,
): Promise<ScoreComponent[] | null> {
  const { data, error } = await admin
    .from("assessment_components")
    .select("id, name, max_score")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Unable to load score components:", error.message);
    return null;
  }

  return (data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    max: Number(item.max_score),
  }));
}
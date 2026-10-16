import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentSession = { id: string; name: string };

/** The current academic session, or null if none has been set. */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("academic_sessions")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the current session:", error.message);
    return null;
  }

  return data
    ? { id: data.id as string, name: data.name as string }
    : null;
}
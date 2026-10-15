import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentTerm = {
  id: string;
  termName: string;
  sessionName: string;
  startDate: string;
  endDate: string;
};

/** The term the school is currently in, or null if none has been set. */
export async function getCurrentTerm(): Promise<CurrentTerm | null> {
  const admin = createAdminClient();

  const { data: term, error } = await admin
    .from("academic_terms")
    .select("id, name, start_date, end_date, session_id")
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the current term:", error.message);
    return null;
  }

  if (!term) return null;

  const { data: session, error: sessionError } = await admin
    .from("academic_sessions")
    .select("name")
    .eq("id", term.session_id)
    .maybeSingle();

  if (sessionError || !session) {
    console.error("Unable to load the current session:", sessionError?.message);
    return null;
  }

  return {
    id: term.id as string,
    termName: term.name as string,
    sessionName: session.name as string,
    startDate: term.start_date as string,
    endDate: term.end_date as string,
  };
}
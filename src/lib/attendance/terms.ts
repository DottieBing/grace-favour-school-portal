import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type TermInfo = { id: string; name: string; sessionId: string };

export type TermLookup =
  | { ok: true; term: TermInfo | null; holiday?: string }
  | { ok: false };

/** The term whose dates include the given day. A school holiday counts as no term. */
export async function findTermForDate(
  admin: Admin,
  date: string,
): Promise<TermLookup> {
  const { data, error } = await admin
    .from("academic_terms")
    .select("id, name, session_id")
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);

  if (error) {
    console.error("Unable to look up the term:", error.message);
    return { ok: false };
  }

  const row = data?.[0];

  if (!row) return { ok: true, term: null };

  const { data: holidays, error: holidayError } = await admin
    .from("school_holidays")
    .select("name")
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);

  if (holidayError) {
    console.error("Unable to check holidays:", holidayError.message);
    return { ok: false };
  }

  if (holidays && holidays.length > 0) {
    return { ok: true, term: null, holiday: holidays[0].name as string };
  }

  return {
    ok: true,
    term: {
      id: row.id as string,
      name: row.name as string,
      sessionId: row.session_id as string,
    },
  };
}
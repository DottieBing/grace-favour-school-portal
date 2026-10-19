import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RecordInput } from "@/lib/attendance/schema";

type Admin = ReturnType<typeof createAdminClient>;

export type SaveOutcome =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function saveRegister(
  admin: Admin,
  args: {
    classId: string;
    date: string;
    termId: string;
    actorId: string;
    isAdmin: boolean;
    records: RecordInput[];
  },
): Promise<SaveOutcome> {
  const { data: roster, error: rosterError } = await admin
    .from("students")
    .select("id")
    .eq("current_class_id", args.classId)
    .eq("status", "active");

  if (rosterError) {
    console.error("Unable to load the class list:", rosterError.message);
    return { ok: false, status: 500, message: "Unable to load the class list." };
  }

  const rosterIds = new Set((roster ?? []).map((item) => item.id as string));
  const sent = new Set(args.records.map((item) => item.studentId));

  if (sent.size !== args.records.length) {
    return {
      ok: false,
      status: 400,
      message: "Each student can only appear once.",
    };
  }

  const matches =
    sent.size === rosterIds.size && [...sent].every((id) => rosterIds.has(id));

  if (!matches) {
    return {
      ok: false,
      status: 409,
      message: "The class list has changed. Refresh the page and try again.",
    };
  }

  const { error } = await admin.rpc("submit_attendance", {
    p_class_id: args.classId,
    p_term_id: args.termId,
    p_date: args.date,
    p_actor: args.actorId,
    p_is_admin: args.isAdmin,
    p_records: args.records.map((item) => ({
      student_id: item.studentId,
      status: item.status,
      note: item.status === "present" ? "" : item.note,
    })),
  });

  if (error) {
    if (error.code === "AT001") {
      return {
        ok: false,
        status: 409,
        message:
          "This register has already been submitted. Ask the administrator to reopen it.",
      };
    }

    if (error.code === "23505") {
      return {
        ok: false,
        status: 409,
        message: "This register was just saved by someone else. Refresh the page.",
      };
    }

    console.error("Saving the register failed:", error.message);

    return {
      ok: false,
      status: 500,
      message: "Unable to save the register.",
    };
  }

  return { ok: true };
}
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeTotals, type FeeStatus } from "@/lib/fees/status";

type Admin = ReturnType<typeof createAdminClient>;

export type StudentBalance = {
  studentId: string;
  owed: number;
  paid: number;
  balance: number;
  status: FeeStatus;
};

type Row = {
  student_id: string;
  charged: number | string;
  discounted: number | string;
  paid: number | string;
  pending: number;
};

/** Everyone's balances, read in pages so the 1,000-row limit never cuts it short. */
export async function loadBalances(
  admin: Admin,
  classId?: string,
): Promise<StudentBalance[] | null> {
  const rows: Row[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .rpc("fee_balances", classId ? { p_class_id: classId } : {})
      .range(from, from + 999);

    if (error) {
      console.error("Unable to load balances:", error.message);
      return null;
    }

    const page = (data ?? []) as Row[];
    rows.push(...page);

    if (page.length < 1000) break;
  }

  return rows.map((row) => {
    const charged = Number(row.charged);
    const discounted = Number(row.discounted);
    const paid = Number(row.paid);
    const totals = computeTotals(charged, discounted, paid, row.pending);

    return {
      studentId: row.student_id,
      owed: totals.owed,
      paid,
      balance: totals.balance,
      status: totals.status,
    };
  });
}
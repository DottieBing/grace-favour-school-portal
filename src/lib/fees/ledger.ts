import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeTotals, type FeeStatus } from "@/lib/fees/status";

type Admin = ReturnType<typeof createAdminClient>;

export type Charge = {
  id: string;
  termId: string;
  termLabel: string;
  startDate: string;
  items: { name: string; amount: number }[];
  total: number;
  discount: number;
};

export type Discount = {
  id: string;
  termId: string;
  termLabel: string;
  amount: number;
  reason: string;
};

export type Payment = {
  id: string;
  amount: number;
  paidOn: string;
  method: string;
  reference: string | null;
  note: string | null;
  source: "office" | "parent";
  status: "reviewing" | "verified" | "rejected" | "reversed";
  receiptNumber: string | null;
  receiptPath: string | null;
  decisionReason: string | null;
};

export type Ledger = {
  charges: Charge[];
  discounts: Discount[];
  payments: Payment[];
  charged: number;
  discounted: number;
  paid: number;
  owed: number;
  balance: number;
  status: FeeStatus;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** One student's charges, discounts and payments, with the balance worked out. */
export async function loadLedger(
  admin: Admin,
  studentId: string,
): Promise<Ledger | null> {
  const [chargesResult, discountsResult, paymentsResult] = await Promise.all([
    admin
      .from("fee_charges")
      .select("id, term_id, items, total")
      .eq("student_id", studentId),
    admin
      .from("fee_discounts")
      .select("id, term_id, amount, reason")
      .eq("student_id", studentId)
      .is("removed_at", null),
    admin
      .from("fee_payments")
      .select(
        "id, amount, paid_on, method, reference, note, source, status, receipt_number, receipt_path, decision_reason",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  ]);

  const failure =
    chargesResult.error ?? discountsResult.error ?? paymentsResult.error;

  if (failure) {
    console.error("Unable to load the fee ledger:", failure.message);
    return null;
  }

  const charges = chargesResult.data ?? [];
  const discounts = discountsResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const termIds = [
    ...new Set([
      ...charges.map((item) => item.term_id as string),
      ...discounts.map((item) => item.term_id as string),
    ]),
  ];

  const terms = new Map<string, { label: string; startDate: string }>();

  if (termIds.length > 0) {
    const termsResult = await admin
      .from("academic_terms")
      .select("id, name, start_date, session_id")
      .in("id", termIds);

    if (termsResult.error) {
      console.error("Unable to load terms:", termsResult.error.message);
      return null;
    }

    const sessionIds = [
      ...new Set((termsResult.data ?? []).map((item) => item.session_id as string)),
    ];

    const sessionsResult = await admin
      .from("academic_sessions")
      .select("id, name")
      .in("id", sessionIds);

    if (sessionsResult.error) {
      console.error("Unable to load sessions:", sessionsResult.error.message);
      return null;
    }

    const sessionName = new Map(
      (sessionsResult.data ?? []).map((item) => [item.id as string, item.name as string]),
    );

    for (const term of termsResult.data ?? []) {
      terms.set(term.id as string, {
        label: `${term.name as string}, ${sessionName.get(term.session_id as string) ?? ""}`,
        startDate: term.start_date as string,
      });
    }
  }

  const discountByTerm = new Map<string, number>();

  for (const item of discounts) {
    const key = item.term_id as string;
    discountByTerm.set(key, (discountByTerm.get(key) ?? 0) + Number(item.amount));
  }

  const chargeList: Charge[] = charges
    .map((item) => {
      const termId = item.term_id as string;
      const term = terms.get(termId);

      return {
        id: item.id as string,
        termId,
        termLabel: term?.label ?? "Term",
        startDate: term?.startDate ?? "",
        items: (item.items as { name: string; amount: number }[]) ?? [],
        total: Number(item.total),
        discount: round2(discountByTerm.get(termId) ?? 0),
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const paymentList: Payment[] = payments.map((item) => ({
    id: item.id as string,
    amount: Number(item.amount),
    paidOn: item.paid_on as string,
    method: item.method as string,
    reference: (item.reference as string | null) ?? null,
    note: (item.note as string | null) ?? null,
    source: item.source as Payment["source"],
    status: item.status as Payment["status"],
    receiptNumber: (item.receipt_number as string | null) ?? null,
    receiptPath: (item.receipt_path as string | null) ?? null,
    decisionReason: (item.decision_reason as string | null) ?? null,
  }));

  const charged = round2(chargeList.reduce((sum, item) => sum + item.total, 0));
  const discounted = round2(
    discounts.reduce((sum, item) => sum + Number(item.amount), 0),
  );
  const paid = round2(
    paymentList
      .filter((item) => item.status === "verified")
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const pending = paymentList.filter((item) => item.status === "reviewing").length;
  const totals = computeTotals(charged, discounted, paid, pending);

  return {
    charges: chargeList,
    discounts: discounts.map((item) => ({
      id: item.id as string,
      termId: item.term_id as string,
      termLabel: terms.get(item.term_id as string)?.label ?? "Term",
      amount: Number(item.amount),
      reason: item.reason as string,
    })),
    payments: paymentList,
    charged,
    discounted,
    paid,
    owed: totals.owed,
    balance: totals.balance,
    status: totals.status,
  };
}
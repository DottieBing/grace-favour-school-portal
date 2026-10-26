import { Suspense } from "react";
import Link from "next/link";

import { requireAreaAccess } from "@/lib/auth/access";
import { loadBalances } from "@/lib/fees/balances";
import { naira } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeesTable, type FeeRow } from "@/components/fees/fees-table";

type Raw = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  current_class_id: string | null;
  classes: { name: string } | { name: string }[] | null;
};

const linkClass =
  "inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50";

async function FeesContent() {
  await requireAreaAccess("fees");

  const admin = createAdminClient();

  const [balances, studentsResult, classesResult, reviewing] = await Promise.all([
    loadBalances(admin),
    admin
      .from("students")
      .select(
        "id, admission_number, first_name, middle_name, last_name, current_class_id, classes(name)",
      )
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(1000),
    admin
      .from("classes")
      .select("id, name")
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin
      .from("fee_payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "reviewing"),
  ]);

  const failed = studentsResult.error ?? classesResult.error ?? reviewing.error;

  if (failed || !balances) {
    if (failed) console.error("Unable to load fees:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the fees. Please refresh the page.
        </div>
      </div>
    );
  }

  const byStudent = new Map(balances.map((item) => [item.studentId, item]));

  const rows: FeeRow[] = ((studentsResult.data ?? []) as unknown as Raw[]).map(
    (item) => {
      const balance = byStudent.get(item.id);
      const cls = Array.isArray(item.classes) ? item.classes[0] : item.classes;

      return {
        id: item.id,
        name: [item.first_name, item.middle_name, item.last_name]
          .filter(Boolean)
          .join(" "),
        admissionNumber: item.admission_number,
        classId: item.current_class_id,
        className: cls?.name ?? null,
        owed: balance?.owed ?? 0,
        paid: balance?.paid ?? 0,
        balance: balance?.balance ?? 0,
        status: balance?.status ?? "no_charges",
      };
    },
  );

  const billed = rows.reduce((sum, row) => sum + row.owed, 0);
  const collected = rows.reduce((sum, row) => sum + row.paid, 0);
  const outstanding = rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const waiting = reviewing.count ?? 0;

  const cards = [
    { label: "Billed (after discounts)", value: naira(billed) },
    { label: "Collected", value: naira(collected) },
    { label: "Outstanding", value: naira(outstanding) },
    { label: "Receipts awaiting review", value: String(waiting) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Fees &amp; Payments</h1>
          <p className="text-sm text-slate-500">
            Balances for active students. Only verified payments count as paid.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/fees/review" className={linkClass}>
            Review payments{waiting > 0 ? ` (${waiting})` : ""}
          </Link>
          <Link href="/admin/fees/setup" className={linkClass}>
            Fee setup
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      <FeesTable
        rows={rows}
        classes={(classesResult.data ?? []).map((item) => ({
          id: item.id as string,
          name: item.name as string,
        }))}
      />
    </div>
  );
}

function FeesFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function FeesPage() {
  return (
    <Suspense fallback={<FeesFallback />}>
      <FeesContent />
    </Suspense>
  );
}
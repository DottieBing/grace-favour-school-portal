import Link from "next/link";

import { loadLedger } from "@/lib/fees/ledger";
import { formatDay, METHOD_LABELS, naira } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeeStatusBadge, PaymentStatusBadge } from "@/components/fees/status-badge";

export async function StudentFeesSection({ studentId }: { studentId: string }) {
  const ledger = await loadLedger(createAdminClient(), studentId);

  if (!ledger) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        We couldn&apos;t load the fee records. Please refresh the page.
      </div>
    );
  }

  if (ledger.charges.length === 0 && ledger.payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-900">No fee records yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Charges appear here once fees are set up and generated for this
          student&apos;s class.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Charged", value: naira(ledger.charged) },
    { label: "Discounts", value: naira(ledger.discounted) },
    { label: "Paid (verified)", value: naira(ledger.paid) },
    {
      label: "Balance",
      value:
        ledger.balance < 0 ? `${naira(-ledger.balance)} credit` : naira(ledger.balance),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FeeStatusBadge status={ledger.status} />
        <Link
          href={`/admin/fees/students/${studentId}`}
          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Open full statement
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Charges by term</h2>
        {ledger.charges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No charges yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {ledger.charges.map((charge) => (
              <li
                key={charge.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-slate-900">{charge.termLabel}</span>
                <span className="text-slate-600">
                  {naira(charge.total)}
                  {charge.discount > 0 ? ` − ${naira(charge.discount)} discount` : ""}
                  {" = "}
                  <span className="font-semibold text-slate-900">
                    {naira(charge.total - charge.discount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Recent payments</h2>
        {ledger.payments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {ledger.payments.slice(0, 5).map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-900">{naira(payment.amount)}</span>
                  <span className="text-xs text-slate-500">
                    {" "}
                    · {formatDay(payment.paidOn)} ·{" "}
                    {METHOD_LABELS[payment.method] ?? payment.method}
                  </span>
                </div>
                <PaymentStatusBadge status={payment.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
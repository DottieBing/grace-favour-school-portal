import { Suspense } from "react";
import Link from "next/link";

import { formatDay, METHOD_LABELS, naira } from "@/lib/fees/money";
import { loadLedger } from "@/lib/fees/ledger";
import { requireStudent } from "@/lib/portal/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClaimForm } from "@/components/portal/claim-form";
import { FeeStatusBadge, PaymentStatusBadge } from "@/components/fees/status-badge";

async function FeesContent() {
  const student = await requireStudent();
  const admin = createAdminClient();

  const [ledger, settingsResult] = await Promise.all([
    loadLedger(admin, student.id),
    admin
      .from("fee_settings")
      .select("bank_name, account_name, account_number, note")
      .maybeSingle(),
  ]);

  if (!ledger || settingsResult.error) {
    if (settingsResult.error) console.error("Unable to load bank details:", settingsResult.error.message);

    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load your fees. Please refresh the page.
        </div>
      </div>
    );
  }

  const bank = settingsResult.data;
  const visiblePayments = ledger.payments;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Fees</h1>
        <FeeStatusBadge status={ledger.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total owed", value: naira(ledger.owed) },
          { label: "Paid", value: naira(ledger.paid) },
          {
            label: "Balance",
            value:
              ledger.balance < 0 ? `${naira(-ledger.balance)} credit` : naira(ledger.balance),
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">How to pay</h2>
        {bank?.bank_name ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">Bank</div>
              <div className="font-medium text-slate-900">{bank.bank_name as string}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Account name</div>
              <div className="font-medium text-slate-900">{bank.account_name as string}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Account number</div>
              <div className="font-mono text-base text-slate-900">{bank.account_number as string}</div>
            </div>
            {bank.note ? <p className="text-slate-600">{bank.note as string}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            The school hasn&apos;t added its bank details yet. Please contact the
            school office.
          </p>
        )}
        <p className="text-sm text-slate-600">
          After you pay, upload your receipt below. The school will check it and
          update your status.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">I&apos;ve paid: upload my receipt</h2>
        <ClaimForm />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Payment history</h2>
        {visiblePayments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {visiblePayments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{naira(payment.amount)}</span>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatDay(payment.paidOn)} · {METHOD_LABELS[payment.method] ?? payment.method}
                    {payment.receiptNumber ? ` · ${payment.receiptNumber}` : ""}
                  </p>
                  {payment.status === "rejected" && payment.decisionReason ? (
                    <p className="text-xs text-red-600">Reason: {payment.decisionReason}</p>
                  ) : null}
                  {payment.status === "reviewing" ? (
                    <p className="text-xs text-amber-700">The school is checking this receipt.</p>
                  ) : null}
                </div>
                {payment.status === "verified" && payment.receiptNumber ? (
                  <Link
                    href={`/portal/fees/receipt/${payment.id}`}
                    className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Receipt
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Charges by term</h2>
        {ledger.charges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No charges yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {ledger.charges.map((charge) => (
              <div key={charge.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{charge.termLabel}</span>
                  <span className="font-semibold text-slate-900">
                    {naira(charge.total - charge.discount)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {charge.items.map((item) => (
                    <li key={item.name} className="flex justify-between">
                      <span>{item.name}</span>
                      <span>{naira(Number(item.amount))}</span>
                    </li>
                  ))}
                  {charge.discount > 0 ? (
                    <li className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span>-{naira(charge.discount)}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function PortalFeesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <FeesContent />
    </Suspense>
  );
}
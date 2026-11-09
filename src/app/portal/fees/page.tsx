import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Check, Clock } from "lucide-react";

import { loadLedger } from "@/lib/fees/ledger";
import { formatDay, METHOD_LABELS, naira } from "@/lib/fees/money";
import { requireStudent } from "@/lib/portal/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeeStatusBadge, PaymentStatusBadge } from "@/components/fees/status-badge";
import { Card } from "@/components/kit/card";
import { PaymentFlow, type BankInfo } from "@/components/portal/payment-flow";

function Tracker({ stage }: { stage: 1 | 2 | 3 }) {
  const labels = ["Receipt sent", "Being reviewed", "Verified"];

  return (
    <ol className="flex items-center">
      {labels.map((label, index) => {
        const number = index + 1;
        const done = stage > number || stage === 3;
        const active = stage === number && stage !== 3;

        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done ? "bg-emerald-500 text-white" : active ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {done ? <Check size={14} /> : active ? <Clock size={14} /> : number}
            </span>
            <span className="ml-2 text-xs text-slate-600">{label}</span>
            {index < labels.length - 1 ? (
              <span className={`mx-2 h-0.5 flex-1 rounded ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

async function FeesContent() {
  await connection();

  const student = await requireStudent();
  const admin = createAdminClient();

  const [ledger, settingsResult] = await Promise.all([
    loadLedger(admin, student.id),
    admin.from("fee_settings").select("bank_name, account_name, account_number, note").maybeSingle(),
  ]);

  if (!ledger || settingsResult.error) {
    if (settingsResult.error) console.error("Unable to load bank details:", settingsResult.error.message);

    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load your fees. Please refresh the page.
        </div>
      </div>
    );
  }

  const bankRow = settingsResult.data;
  const bank: BankInfo | null = bankRow?.bank_name
    ? {
        bankName: bankRow.bank_name as string,
        accountName: bankRow.account_name as string,
        accountNumber: bankRow.account_number as string,
        note: (bankRow.note as string | null) ?? null,
      }
    : null;

  const paid = ledger.status === "paid";
  const payable = ledger.status !== "no_charges" && ledger.balance > 0;
  const latest = ledger.payments[0];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <section
        className={`anim-fade-up rounded-3xl p-5 text-white shadow-lg sm:p-7 ${
          paid
            ? "bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-emerald-700/20"
            : "bg-gradient-to-br from-[#0D5C63] to-[#083B40] shadow-[#0D5C63]/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-white/70">{paid ? "All paid up" : "Balance to pay"}</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              {ledger.balance < 0 ? `${naira(-ledger.balance)} credit` : naira(Math.max(0, ledger.balance))}
            </p>
          </div>
          <span className="rounded-full bg-white/90 px-1 py-0.5">
            <FeeStatusBadge status={ledger.status} />
          </span>
        </div>
        <div className="mt-4 flex gap-6 text-sm text-white/80">
          <span>Owed {naira(ledger.owed)}</span>
          <span>Paid {naira(ledger.paid)}</span>
        </div>

        {payable ? (
          <a
            href="#pay"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#0D5C63] shadow-sm transition hover:bg-[#F1F8F7]"
          >
            Pay now
          </a>
        ) : null}
      </section>

      <div id="pay" className="scroll-mt-24">
        <Card delay={80}>
          <h2 className="mb-4 font-semibold text-slate-900">Make a payment</h2>
          {payable ? (
            <PaymentFlow balance={ledger.balance} bank={bank} admissionNumber={student.admissionNumber} />
          ) : (
            <p className="text-sm text-slate-500">
              {ledger.status === "no_charges"
                ? "No fees have been charged yet. The school will charge fees at the start of each term, and the payment steps appear here when there is a balance."
                : "Nothing is owed right now. Thank you!"}
            </p>
          )}
        </Card>
      </div>

      {latest && latest.source === "parent" && (latest.status === "reviewing" || latest.status === "verified") ? (
        <Card delay={120}>
          <h2 className="mb-4 font-semibold text-slate-900">Your latest payment</h2>
          <Tracker stage={latest.status === "verified" ? 3 : 2} />
          <p className="mt-3 text-sm text-slate-600">
            {naira(latest.amount)} ·{" "}
            {latest.status === "verified" ? "Verified. Thank you!" : "The school is checking this receipt."}
          </p>
        </Card>
      ) : null}

      {latest && latest.status === "rejected" ? (
        <Card delay={120} className="border-red-200 bg-red-50/60">
          <h2 className="font-semibold text-red-800">Your last receipt wasn&apos;t accepted</h2>
          <p className="mt-1 text-sm text-red-700">
            {latest.decisionReason ?? "Please upload a clearer receipt."} You can send a new one above.
          </p>
        </Card>
      ) : null}

      <Card delay={160}>
        <h2 className="font-semibold text-slate-900">Payment history</h2>

        {ledger.payments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {ledger.payments.map((payment) => (
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
                </div>
                {payment.status === "verified" && payment.receiptNumber ? (
                  <Link
                    href={`/portal/fees/receipt/${payment.id}`}
                    className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Receipt
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card delay={200}>
        <h2 className="font-semibold text-slate-900">Charges by term</h2>

        {ledger.charges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No charges yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {ledger.charges.map((charge) => (
              <details key={charge.id} className="rounded-xl border border-slate-200 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{charge.termLabel}</span>
                  <span className="font-semibold text-slate-900">{naira(charge.total - charge.discount)}</span>
                </summary>
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
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function PortalFeesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-[#E3EAE6]" />}>
      <FeesContent />
    </Suspense>
  );
}
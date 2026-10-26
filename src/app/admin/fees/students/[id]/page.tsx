import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { formatDay, METHOD_LABELS, naira } from "@/lib/fees/money";
import { loadLedger } from "@/lib/fees/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { DiscountSheet } from "@/components/fees/discount-sheet";
import { RecordPaymentSheet } from "@/components/fees/record-payment-sheet";
import { ReasonButton } from "@/components/fees/review-actions";
import { FeeStatusBadge, PaymentStatusBadge } from "@/components/fees/status-badge";

type Raw = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  classes: { name: string } | { name: string }[] | null;
};

async function StatementContent({ params }: { params: Promise<{ id: string }> }) {
  const { canManage } = await requireAreaAccess("fees");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [studentResult, ledger] = await Promise.all([
    admin
      .from("students")
      .select("id, admission_number, first_name, middle_name, last_name, classes(name)")
      .eq("id", id)
      .maybeSingle(),
    loadLedger(admin, id),
  ]);

  if (studentResult.error || !ledger) {
    if (studentResult.error) console.error("Unable to load student:", studentResult.error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this statement. Please refresh the page.
        </div>
      </div>
    );
  }

  const student = studentResult.data as unknown as Raw | null;

  if (!student) {
    notFound();
  }

  const name = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
  const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;

  const fileLinks = new Map<string, string>();

  await Promise.all(
    ledger.payments
      .filter((item) => item.receiptPath)
      .map(async (item) => {
        const { data } = await admin.storage
          .from("fee-receipts")
          .createSignedUrl(item.receiptPath as string, 3600);

        if (data?.signedUrl) fileLinks.set(item.id, data.signedUrl);
      }),
  );

  const termChoices = ledger.charges.map((item) => ({
    id: item.termId,
    label: item.termLabel,
  }));

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/fees"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to fees
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
            <FeeStatusBadge status={ledger.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {cls?.name ?? "No class"} ·{" "}
            <span className="font-mono">{student.admission_number}</span>
          </p>
          <Link
            href={`/admin/students/${student.id}`}
            className="mt-1 inline-block text-xs text-[#0D5C63] hover:underline"
          >
            Open student profile
          </Link>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-3">
            <DiscountSheet studentId={student.id} studentName={name} terms={termChoices} />
            <RecordPaymentSheet studentId={student.id} studentName={name} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Charged", value: naira(ledger.charged) },
          { label: "Discounts", value: naira(ledger.discounted) },
          { label: "Paid (verified)", value: naira(ledger.paid) },
          {
            label: "Balance",
            value:
              ledger.balance < 0
                ? `${naira(-ledger.balance)} credit`
                : naira(ledger.balance),
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Charges by term</h2>
        {ledger.charges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No charges yet. Generate them on the Fee setup page.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Term</th>
                  <th className="py-2 pr-3 font-medium">Items</th>
                  <th className="py-2 pr-3 font-medium">Charged</th>
                  <th className="py-2 pr-3 font-medium">Discount</th>
                  <th className="py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {ledger.charges.map((charge) => (
                  <tr key={charge.id} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium text-slate-900">{charge.termLabel}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {charge.items
                        .map((item) => `${item.name} ${naira(Number(item.amount))}`)
                        .join(" · ")}
                    </td>
                    <td className="py-2 pr-3">{naira(charge.total)}</td>
                    <td className="py-2 pr-3">{charge.discount > 0 ? naira(charge.discount) : "-"}</td>
                    <td className="py-2 font-medium text-slate-900">
                      {naira(charge.total - charge.discount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ledger.discounts.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">Discounts</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {ledger.discounts.map((discount) => (
              <li key={discount.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{naira(discount.amount)}</span>{" "}
                  <span className="text-slate-600">· {discount.termLabel}</span>
                  <div className="text-xs text-slate-500">{discount.reason}</div>
                </div>
                {canManage ? (
                  <ReasonButton
                    url={`/api/admin/fees/discounts/${discount.id}`}
                    method="PATCH"
                    body={{ isActive: false }}
                    askReason={false}
                    label="Remove"
                    title="Remove this discount?"
                    description="What the student owes goes back up by this amount. The discount stays in the history."
                    confirmLabel="Remove discount"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
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
                    {payment.source === "parent" ? " · uploaded by parent" : " · office"}
                    {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                    {payment.receiptNumber ? ` · ${payment.receiptNumber}` : ""}
                  </p>
                  {payment.decisionReason ? (
                    <p className="text-xs text-slate-500">Reason: {payment.decisionReason}</p>
                  ) : null}
                  {fileLinks.get(payment.id) ? (
                    <a
                      href={fileLinks.get(payment.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[#0D5C63] hover:underline"
                    >
                      View uploaded receipt file
                    </a>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  {payment.receiptNumber &&
                  (payment.status === "verified" || payment.status === "reversed") ? (
                    <Link
                      href={`/admin/fees/receipt/${payment.id}`}
                      className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                    >
                      Receipt
                    </Link>
                  ) : null}
                  {canManage && payment.status === "verified" ? (
                    <ReasonButton
                      url={`/api/admin/fees/payments/${payment.id}/review`}
                      body={{ action: "reverse" }}
                      label="Reverse"
                      title="Reverse this payment?"
                      description="It stops counting toward the balance. The receipt is kept and marked reversed. Give a reason for the record."
                      confirmLabel="Reverse payment"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatementFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<StatementFallback />}>
      <StatementContent params={params} />
    </Suspense>
  );
}
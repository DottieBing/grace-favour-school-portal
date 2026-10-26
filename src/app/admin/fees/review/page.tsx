import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/access";
import { formatDay, naira } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReasonButton, VerifyButton } from "@/components/fees/review-actions";

type Raw = {
  id: string;
  amount: number | string;
  paid_on: string;
  reference: string | null;
  receipt_path: string | null;
  student_id: string;
  students:
    | {
        admission_number: string;
        first_name: string;
        middle_name: string | null;
        last_name: string;
        classes: { name: string } | { name: string }[] | null;
      }
    | {
        admission_number: string;
        first_name: string;
        middle_name: string | null;
        last_name: string;
        classes: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

async function ReviewContent() {
  const { canManage } = await requireAreaAccess("fees");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("fee_payments")
    .select(
      "id, amount, paid_on, reference, receipt_path, student_id, students(admission_number, first_name, middle_name, last_name, classes(name))",
    )
    .eq("status", "reviewing")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Unable to load claims:", error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the receipts. Please refresh the page.
        </div>
      </div>
    );
  }

  const claims = (data ?? []) as unknown as Raw[];

  const links = new Map<string, string>();

  await Promise.all(
    claims
      .filter((item) => item.receipt_path)
      .map(async (item) => {
        const { data: signed } = await admin.storage
          .from("fee-receipts")
          .createSignedUrl(item.receipt_path as string, 3600);

        if (signed?.signedUrl) links.set(item.id, signed.signedUrl);
      }),
  );

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/fees"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to fees
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Review payments</h1>
        <p className="text-sm text-slate-500">
          Receipts parents have uploaded. Check the money is in the account,
          then verify. Nothing counts as paid until you do.
        </p>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nothing is waiting for review.
        </div>
      ) : (
        <ul className="space-y-3">
          {claims.map((claim) => {
            const student = Array.isArray(claim.students) ? claim.students[0] : claim.students;
            const cls = student
              ? Array.isArray(student.classes)
                ? student.classes[0]
                : student.classes
              : null;
            const name = student
              ? [student.first_name, student.middle_name, student.last_name]
                  .filter(Boolean)
                  .join(" ")
              : "Student";
            const amount = Number(claim.amount);
            const link = links.get(claim.id);

            return (
              <li
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/admin/fees/students/${claim.student_id}`}
                    className="font-medium text-slate-900 hover:text-[#0D5C63] hover:underline"
                  >
                    {name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{student?.admission_number}</span>
                    {cls ? ` · ${cls.name}` : ""}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{naira(amount)}</span> paid on{" "}
                    {formatDay(claim.paid_on)}
                    {claim.reference ? ` · Ref: ${claim.reference}` : ""}
                  </p>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[#0D5C63] hover:underline"
                    >
                      View receipt file
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400">Receipt file unavailable</p>
                  )}
                </div>

                {canManage ? (
                  <div className="flex gap-2">
                    <ReasonButton
                      url={`/api/admin/fees/payments/${claim.id}/review`}
                      body={{ action: "reject" }}
                      label="Reject"
                      title={`Reject ${name}'s receipt?`}
                      description="The parent will see your reason and can upload a new receipt."
                      confirmLabel="Reject receipt"
                    />
                    <VerifyButton paymentId={claim.id} amount={amount} studentName={name} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReviewFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <ReviewContent />
    </Suspense>
  );
}
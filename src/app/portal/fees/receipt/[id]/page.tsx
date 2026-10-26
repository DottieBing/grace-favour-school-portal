import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireStudent } from "@/lib/portal/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReceiptCard } from "@/components/fees/receipt-card";
import { PrintButton } from "@/components/students/print-button";

async function ReceiptContent({ params }: { params: Promise<{ id: string }> }) {
  const student = await requireStudent();
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  // Only this student's own verified payments: the student comes from the session.
  const { data, error } = await admin
    .from("fee_payments")
    .select("amount, paid_on, method, reference, receipt_number")
    .eq("id", id)
    .eq("student_id", student.id)
    .eq("status", "verified")
    .maybeSingle();

  if (error) {
    console.error("Unable to load receipt:", error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this receipt. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!data || !data.receipt_number) {
    notFound();
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/portal/fees"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to fees
        </Link>
        <PrintButton />
      </div>

      <ReceiptCard
        receiptNumber={data.receipt_number as string}
        reversed={false}
        studentName={student.name}
        admissionNumber={student.admissionNumber}
        className={student.className}
        amount={Number(data.amount)}
        paidOn={data.paid_on as string}
        method={data.method as string}
        reference={(data.reference as string | null) ?? null}
      />
    </div>
  );
}

export default function PortalReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <ReceiptContent params={params} />
    </Suspense>
  );
}
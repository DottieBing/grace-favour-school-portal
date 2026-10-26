import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReceiptCard } from "@/components/fees/receipt-card";
import { PrintButton } from "@/components/students/print-button";

type Raw = {
  amount: number | string;
  paid_on: string;
  method: string;
  reference: string | null;
  status: string;
  receipt_number: string | null;
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

async function ReceiptContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAreaAccess("fees");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("fee_payments")
    .select(
      "amount, paid_on, method, reference, status, receipt_number, student_id, students(admission_number, first_name, middle_name, last_name, classes(name))",
    )
    .eq("id", id)
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

  const payment = data as unknown as Raw | null;

  if (
    !payment ||
    !payment.receipt_number ||
    (payment.status !== "verified" && payment.status !== "reversed")
  ) {
    notFound();
  }

  const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;

  if (!student) {
    notFound();
  }

  const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/fees/students/${payment.student_id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to statement
        </Link>
        <PrintButton />
      </div>

      <ReceiptCard
        receiptNumber={payment.receipt_number}
        reversed={payment.status === "reversed"}
        studentName={[student.first_name, student.middle_name, student.last_name]
          .filter(Boolean)
          .join(" ")}
        admissionNumber={student.admission_number}
        className={cls?.name ?? null}
        amount={Number(payment.amount)}
        paidOn={payment.paid_on}
        method={payment.method}
        reference={payment.reference}
      />
    </div>
  );
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <ReceiptContent params={params} />
    </Suspense>
  );
}
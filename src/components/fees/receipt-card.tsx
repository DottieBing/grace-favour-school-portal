import { SchoolLogo } from "@/components/brand/school-logo";
import { METHOD_LABELS, formatDay, naira } from "@/lib/fees/money";
import { getSchoolProfile } from "@/lib/settings/school";

export async function ReceiptCard({
  receiptNumber,
  reversed,
  studentName,
  admissionNumber,
  className,
  amount,
  paidOn,
  method,
  reference,
}: {
  receiptNumber: string;
  reversed: boolean;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  amount: number;
  paidOn: string;
  method: string;
  reference: string | null;
}) {
  const school = await getSchoolProfile();

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-xl border border-slate-200 bg-white p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="border-b border-slate-200 pb-4 text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center">
          <SchoolLogo size={56} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {school.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Payment receipt</p>
      </header>

      {reversed ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-semibold text-red-700">
          REVERSED. This payment was cancelled and no longer counts.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-slate-500">Receipt number</div>
          <div className="font-mono font-medium text-slate-900">{receiptNumber}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Date paid</div>
          <div className="text-slate-900">{formatDay(paidOn)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Student</div>
          <div className="font-medium text-slate-900">{studentName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Admission number</div>
          <div className="font-mono text-slate-900">{admissionNumber}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Class</div>
          <div className="text-slate-900">{className ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Method</div>
          <div className="text-slate-900">{METHOD_LABELS[method] ?? method}</div>
        </div>
        {reference ? (
          <div className="col-span-2">
            <div className="text-xs text-slate-500">Reference</div>
            <div className="text-slate-900">{reference}</div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg bg-slate-50 p-4 text-center">
        <div className="text-xs text-slate-500">Amount received</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">{naira(amount)}</div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Thank you. Please keep this receipt for your records.
      </p>
    </div>
  );
}
import {
  FEE_STATUS_LABELS,
  FEE_STATUS_STYLES,
  type FeeStatus,
} from "@/lib/fees/status";

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${FEE_STATUS_STYLES[status]}`}
    >
      {FEE_STATUS_LABELS[status]}
    </span>
  );
}

const PAYMENT_STYLES = {
  reviewing: ["Reviewing", "bg-amber-50 text-amber-700"],
  verified: ["Verified", "bg-emerald-50 text-emerald-700"],
  rejected: ["Rejected", "bg-red-50 text-red-700"],
  reversed: ["Reversed", "bg-slate-100 text-slate-600"],
} as const;

export function PaymentStatusBadge({
  status,
}: {
  status: keyof typeof PAYMENT_STYLES;
}) {
  const [label, style] = PAYMENT_STYLES[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
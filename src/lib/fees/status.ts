export type FeeStatus = "no_charges" | "unpaid" | "reviewing" | "part" | "paid";

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  no_charges: "No charges",
  unpaid: "Unpaid",
  reviewing: "Reviewing",
  part: "Part paid",
  paid: "Paid",
};

export const FEE_STATUS_STYLES: Record<FeeStatus, string> = {
  no_charges: "bg-slate-100 text-slate-600",
  unpaid: "bg-red-50 text-red-700",
  reviewing: "bg-amber-50 text-amber-700",
  part: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeTotals(
  charged: number,
  discounted: number,
  paid: number,
  pending: number,
) {
  const owed = round2(charged - discounted);
  const balance = round2(owed - paid);

  let status: FeeStatus;

  if (pending > 0) status = "reviewing";
  else if (charged <= 0) status = "no_charges";
  else if (balance <= 0) status = "paid";
  else if (paid > 0) status = "part";
  else status = "unpaid";

  return { owed, balance, status };
}
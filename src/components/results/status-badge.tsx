import { SHEET_STATE_LABELS, type SheetState } from "@/lib/results/types";

const STYLES: Record<SheetState, string> = {
  not_started: "bg-red-50 text-red-700",
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
};

export function StatusBadge({ state }: { state: SheetState }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[state]}`}
    >
      {SHEET_STATE_LABELS[state]}
    </span>
  );
}
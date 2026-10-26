"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { naira } from "@/lib/fees/money";

export type OtherClassFees = {
  id: string;
  name: string;
  amounts: Record<string, string>;
};

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function StructureEditor({
  classId,
  termId,
  items,
  initial,
  others,
}: {
  classId: string;
  termId: string;
  items: { id: string; name: string }[];
  initial: Record<string, string>;
  others: OtherClassFees[];
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((sum, item) => {
    const value = Number(amounts[item.id] ?? "");
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);

  function copyFrom(otherId: string) {
    const source = others.find((item) => item.id === otherId);
    if (!source) return;

    setSaved(false);
    setAmounts(
      Object.fromEntries(
        items
          .filter((item) => source.amounts[item.id])
          .map((item) => [item.id, source.amounts[item.id]]),
      ),
    );
  }

  async function save() {
    setError(null);
    setSaved(false);

    const body: { itemId: string; amount: number | null }[] = [];

    for (const item of items) {
      const text = (amounts[item.id] ?? "").trim();

      if (text === "") {
        body.push({ itemId: item.id, amount: null });
        continue;
      }

      const value = Number(text);

      if (!Number.isFinite(value) || value <= 0) {
        setError(`Enter a valid amount for ${item.name}, or leave it empty.`);
        return;
      }

      body.push({ itemId: item.id, amount: value });
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/fees/structure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, termId, amounts: body }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Add fee items first, then set their amounts here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {others.length > 0 ? (
        <select
          className={selectClass}
          value=""
          onChange={(event) => copyFrom(event.target.value)}
          aria-label="Copy from another class"
        >
          <option value="">Copy from another class (same term)...</option>
          {others.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <span className="w-40 text-sm text-slate-900">{item.name}</span>
            <Input
              value={amounts[item.id] ?? ""}
              onChange={(event) => {
                setSaved(false);
                setAmounts((previous) => ({ ...previous, [item.id]: event.target.value }));
              }}
              inputMode="decimal"
              placeholder="Not charged"
              aria-label={`${item.name} amount`}
              className="max-w-[12rem]"
            />
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        Total per student: <span className="font-semibold text-slate-900">{naira(total)}</span>
      </p>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save fees"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
    </div>
  );
}
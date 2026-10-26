"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BankData = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string;
};

export function BankForm({ initial }: { initial: BankData }) {
  const router = useRouter();
  const [values, setValues] = useState<BankData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof BankData, value: string) {
    setSaved(false);
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/admin/fees/bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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

  return (
    <form onSubmit={save} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bankName">Bank</Label>
          <Input id="bankName" required value={values.bankName} onChange={(e) => set("bankName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accountNumber">Account number</Label>
          <Input id="accountNumber" required inputMode="numeric" value={values.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accountName">Account name</Label>
        <Input id="accountName" required value={values.accountName} onChange={(e) => set("accountName", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bankNote">Note for parents (optional)</Label>
        <Input
          id="bankNote"
          placeholder="e.g. Use the admission number as the payment reference"
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save bank details"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
    </form>
  );
}
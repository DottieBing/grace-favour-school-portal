"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClaimForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (!file) {
      setError("Attach your receipt (an image or a PDF).");
      return;
    }

    setSaving(true);

    try {
      const form = new FormData();
      form.append("amount", amount);
      form.append("paidOn", paidOn);
      form.append("reference", reference);
      form.append("receipt", file);

      const response = await fetch("/api/portal/fees/claims", {
        method: "POST",
        body: form,
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setAmount("");
      setReference("");
      setFile(null);
      setFileKey((key) => key + 1);
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="claim-amount">Amount you paid (₦)</Label>
          <Input id="claim-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-date">Date you paid</Label>
          <Input id="claim-date" type="date" required value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="claim-ref">Reference or teller number (optional)</Label>
        <Input id="claim-ref" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="claim-file">Receipt (image or PDF, up to 5 MB)</Label>
        <Input
          key={fileKey}
          id="claim-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {done ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Thank you. Your receipt has been sent and is being reviewed by the school.
        </p>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Uploading..." : "Send receipt"}
      </Button>
    </form>
  );
}
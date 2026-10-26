"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function RecordPaymentSheet({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    setAmount("");
    setPaidOn(new Date().toLocaleDateString("en-CA"));
    setMethod("cash");
    setReference("");
    setNote("");
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter the amount paid.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, amount: value, paidOn, method, reference, note }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={openSheet} className="gap-2">
        <Plus className="size-4" />
        Record payment
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} className="space-y-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>Record payment</SheetTitle>
              <SheetDescription>
                For {studentName}. A payment taken at the office is verified
                straight away and gets a receipt number.
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">Amount (₦)</Label>
                <Input id="pay-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-date">Paid on</Label>
                <Input id="pay-date" type="date" required value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Method</Label>
              <select id="pay-method" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="pos">POS</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Record payment"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
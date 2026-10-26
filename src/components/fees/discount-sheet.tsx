"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function DiscountSheet({
  studentId,
  studentName,
  terms,
}: {
  studentId: string;
  studentName: string;
  terms: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [termId, setTermId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    setTermId(terms[0]?.id ?? "");
    setAmount("");
    setReason("");
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter the discount amount.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/fees/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, termId, amount: value, reason }),
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
      <Button type="button" variant="outline" disabled={terms.length === 0} onClick={openSheet}>
        Add discount
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} className="space-y-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>Add discount</SheetTitle>
              <SheetDescription>
                Reduces what {studentName} owes for one term, for a scholarship
                or sibling discount, say. A reason is required.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="disc-term">Term</Label>
              <select id="disc-term" className={selectClass} value={termId} onChange={(e) => setTermId(e.target.value)}>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="disc-amount">Amount (₦)</Label>
              <Input id="disc-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="disc-reason">Reason</Label>
              <Input
                id="disc-reason"
                required
                placeholder="e.g. Sibling discount"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
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
                {saving ? "Saving..." : "Add discount"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
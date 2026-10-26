"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function VerifyButton({
  paymentId,
  amount,
  studentName,
}: {
  paymentId: string;
  amount: number;
  studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(amount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter the amount you confirmed in the account.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/fees/payments/${paymentId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          ...(parsed !== amount ? { amount: parsed } : {}),
        }),
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
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setValue(String(amount));
          setError(null);
          setOpen(true);
        }}
      >
        Verify
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify {studentName}&apos;s payment?</DialogTitle>
            <DialogDescription>
              Only verify after you&apos;ve seen the money in the account. If the
              amount received differs from what the parent entered, correct it
              here. A receipt number is created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="verify-amount" className="text-sm font-medium">
              Amount received (₦)
            </label>
            <Input
              id="verify-amount"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={saving}>
              {saving ? "Verifying..." : "Verify payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Reject a claim, reverse a payment or remove a discount, with a confirmation. */
export function ReasonButton({
  url,
  method = "POST",
  body,
  label,
  title,
  description,
  confirmLabel,
  askReason = true,
}: {
  url: string;
  method?: string;
  body: Record<string, unknown>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  askReason?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (askReason && reason.trim().length < 3) {
      setError("Give a reason.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(askReason ? { ...body, reason } : body),
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
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setReason("");
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {askReason ? (
            <Input
              placeholder="Reason (the parent can see it for rejected receipts)"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              aria-label="Reason"
            />
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={saving}>
              {saving ? "Saving..." : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
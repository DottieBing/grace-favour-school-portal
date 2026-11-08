"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, PartyPopper } from "lucide-react";

import { Confetti } from "@/components/kit/confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { naira } from "@/lib/fees/money";

export type BankInfo = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string | null;
};

const STEPS = ["Amount", "Pay", "Receipt"];
const MAX_BYTES = 4 * 1024 * 1024;

export function PaymentFlow({
  balance,
  bank,
  admissionNumber,
}: {
  balance: number;
  bank: BankInfo | null;
  admissionNumber: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"full" | "part">("full");
  const [part, setPart] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = mode === "full" ? balance : Number(part);
  const amountOk =
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= balance + 0.001 &&
    Math.round(amount * 100) / 100 === amount;

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  function toAmount() {
    setError(null);

    if (!amountOk) {
      setError(
        mode === "part"
          ? `Enter an amount above 0 and up to ${naira(balance)}, with at most two decimals.`
          : "There is nothing to pay.",
      );
      return;
    }

    setStep(2);
  }

  function toReceipt() {
    setError(null);
    if (!paidOn) setPaidOn(new Date().toLocaleDateString("en-CA"));
    setStep(3);
  }

  async function submit() {
    setError(null);

    if (!file) {
      setError("Attach your receipt (an image or a PDF).");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("The receipt must be 4 MB or smaller.");
      return;
    }

    setSaving(true);

    try {
      const form = new FormData();
      form.append("amount", String(amount));
      form.append("paidOn", paidOn);
      form.append("reference", reference);
      form.append("receipt", file);

      const response = await fetch("/api/portal/fees/claims", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStep(4);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep(1);
    setMode("full");
    setPart("");
    setReference("");
    setFile(null);
    setError(null);
  }

  if (step === 4) {
    return (
      <div className="anim-pop space-y-3 py-4 text-center">
        <Confetti />
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <PartyPopper size={30} />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Receipt sent</h3>
        <p className="mx-auto max-w-sm text-sm text-slate-500">
          Thank you. The school will check the payment and update your status. You can follow it below.
        </p>
        <Button type="button" variant="outline" onClick={reset} className="rounded-full">
          Make another payment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="flex items-center">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const done = step > number;
          const active = step === number;

          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done ? "bg-emerald-500 text-white" : active ? "bg-[#0D5C63] text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? <Check size={16} /> : number}
              </span>
              <span className={`ml-2 text-sm ${active ? "font-medium text-slate-900" : "text-slate-500"}`}>
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <span className={`mx-3 h-0.5 flex-1 rounded ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
              ) : null}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div key="step1" className="anim-slide space-y-3">
          <p className="text-sm text-slate-600">How much would you like to pay?</p>

          <button
            type="button"
            onClick={() => setMode("full")}
            className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
              mode === "full" ? "border-[#0D5C63] bg-[#F1F8F7]" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span>
              <span className="block font-semibold text-slate-900">Pay the full balance</span>
              <span className="text-sm text-slate-500">Clears everything owed</span>
            </span>
            <span className="text-lg font-semibold text-slate-900">{naira(balance)}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("part")}
            className={`block w-full rounded-2xl border-2 p-4 text-left transition ${
              mode === "part" ? "border-[#0D5C63] bg-[#F1F8F7]" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="block font-semibold text-slate-900">Pay part of it</span>
            <span className="text-sm text-slate-500">Choose how much to pay now</span>
          </button>

          {mode === "part" ? (
            <div className="anim-fade-up space-y-1.5">
              <label htmlFor="part-amount" className="text-sm font-medium">
                Amount (₦)
              </label>
              <Input
                id="part-amount"
                inputMode="decimal"
                placeholder={`Up to ${balance}`}
                value={part}
                onChange={(event) => setPart(event.target.value)}
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="button" onClick={toAmount} className="h-11 w-full rounded-full">
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div key="step2" className="anim-slide space-y-4">
          <div className="rounded-2xl bg-[#F1F8F7] p-4 text-center">
            <p className="text-xs text-slate-500">Transfer exactly</p>
            <p className="text-3xl font-semibold tracking-tight text-[#0D5C63]">{naira(amount)}</p>
          </div>

          {bank ? (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {[
                ["Bank", bank.bankName, "bank"],
                ["Account name", bank.accountName, "name"],
                ["Account number", bank.accountNumber, "number"],
              ].map(([label, value, key]) => (
                <div key={key} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`truncate font-medium text-slate-900 ${key === "number" ? "font-mono text-lg" : ""}`}>
                      {value}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(key, value)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copied === key ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copied === key ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              The school hasn&apos;t added its bank details yet. Please contact the school office.
            </p>
          )}

          <p className="text-sm text-slate-600">
            Use <span className="font-mono font-medium">{admissionNumber}</span> as the payment reference so the
            school can match it. {bank?.note ?? ""}
          </p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-11 rounded-full px-5">
              Back
            </Button>
            <Button type="button" onClick={toReceipt} disabled={!bank} className="h-11 flex-1 rounded-full">
              I&apos;ve paid
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div key="step3" className="anim-slide space-y-4">
          <p className="text-sm text-slate-600">
            Upload the receipt for <span className="font-semibold">{naira(amount)}</span>.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="paid-on" className="text-sm font-medium">
              Date you paid
            </label>
            <Input id="paid-on" type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="paid-ref" className="text-sm font-medium">
              Teller or reference number (optional)
            </label>
            <Input id="paid-ref" maxLength={80} value={reference} onChange={(event) => setReference(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="paid-file" className="text-sm font-medium">
              Receipt (image or PDF, up to 4 MB)
            </label>
            <Input
              id="paid-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="h-11 rounded-full px-5">
              Back
            </Button>
            <Button type="button" onClick={submit} disabled={saving || !paidOn} className="h-11 flex-1 rounded-full">
              {saving ? "Sending..." : "Send receipt"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
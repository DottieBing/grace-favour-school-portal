"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

import { SchoolLogo } from "@/components/brand/school-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function post(url: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

    return response.ok
      ? { ok: true as const, message: data.message ?? "" }
      : { ok: false as const, error: data.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false as const, error: "Network error. Check your connection and try again." };
  }
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"ask" | "reset" | "done">("ask");
  const [admission, setAdmission] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await post("/api/auth/recover/request", { admissionNumber: admission });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote(result.message);
    setStep("reset");
  }

  async function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setBusy(true);

    const result = await post("/api/auth/recover/confirm", {
      admissionNumber: admission,
      code,
      password,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStep("done");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7F5] p-5">
      <div className="anim-pop w-full max-w-md space-y-6 rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-[#E2E8E1] bg-white p-1">
            <SchoolLogo size={34} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Forgot your password?</h1>
            <p className="text-sm text-slate-500">For students and parents</p>
          </div>
        </div>

        {step === "ask" ? (
          <form onSubmit={ask} className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter the student&apos;s admission number. If a verified email is saved on the Account page, we&apos;ll
              send a 6-digit code to it.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="adm" className="text-sm font-medium">
                Admission number
              </label>
              <Input
                id="adm"
                required
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="GFMS2627001"
                value={admission}
                onChange={(event) => setAdmission(event.target.value)}
                className="h-10 font-mono"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
              {busy ? "Sending..." : "Send me a code"}
            </Button>
            <p className="text-xs text-slate-500">
              No verified email on file? Please contact the school office, and they can reset the password for you.
              Staff should ask the school owner.
            </p>
          </form>
        ) : null}

        {step === "reset" ? (
          <form onSubmit={reset} className="anim-slide space-y-4">
            {note ? <p className="rounded-xl bg-[#F1F8F7] p-3 text-sm text-slate-700">{note}</p> : null}

            <div className="space-y-1.5">
              <label htmlFor="code" className="text-sm font-medium">
                6-digit code
              </label>
              <Input
                id="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                className="h-11 max-w-[12rem] text-center font-mono text-xl tracking-[0.4em]"
                placeholder="000000"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new" className="text-sm font-medium">
                New password
              </label>
              <Input
                id="new"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10"
              />
              <p className="text-xs text-slate-500">At least 8 characters.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="again" className="text-sm font-medium">
                Confirm new password
              </label>
              <Input
                id="again"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="h-10"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full rounded-full">
              {busy ? "Saving..." : "Change password"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("ask");
                setError(null);
                setCode("");
              }}
              className="text-sm text-[#0D5C63] hover:underline"
            >
              Start again
            </button>
          </form>
        ) : null}

        {step === "done" ? (
          <div className="anim-pop space-y-4 py-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={28} />
            </div>
            <p className="font-medium text-slate-900">Your password has been changed.</p>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full bg-[#0D5C63] px-6 text-sm font-medium text-white hover:bg-[#09494F]"
            >
              Go to sign in
            </Link>
          </div>
        ) : null}

        {step !== "done" ? (
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        ) : null}
      </div>
    </main>
  );
}
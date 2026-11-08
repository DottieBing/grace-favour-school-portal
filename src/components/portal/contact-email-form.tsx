"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function call(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    return response.ok ? null : (data.error ?? "Something went wrong. Please try again.");
  } catch {
    return "Network error. Check your connection and try again.";
  }
}

export function ContactEmailForm({
  initialEmail,
  verified: initialVerified,
  hasGuardian,
}: {
  initialEmail: string;
  verified: boolean;
  hasGuardian: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [verified, setVerified] = useState(initialVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "save" | "send" | "verify">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!hasGuardian) {
    return <p className="text-sm text-slate-500">No parent or guardian is linked to this account yet.</p>;
  }

  const changed = email.trim().toLowerCase() !== savedEmail.toLowerCase();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    setNote(null);

    const problem = await call("/api/portal/account/email", "PUT", { email });

    setBusy(null);

    if (problem) {
      setError(problem);
      return;
    }

    setSavedEmail(email.trim().toLowerCase());
    setVerified(false);
    setCodeSent(false);
    setCode("");
    setNote("Saved. Now send yourself a verification code.");
    router.refresh();
  }

  async function sendCode() {
    setBusy("send");
    setError(null);
    setNote(null);

    const problem = await call("/api/portal/account/email/send-code", "POST");

    setBusy(null);

    if (problem) {
      setError(problem);
      return;
    }

    setCodeSent(true);
    setNote(`We sent a 6-digit code to ${savedEmail}. It's valid for 10 minutes.`);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("verify");
    setError(null);
    setNote(null);

    const problem = await call("/api/portal/account/email/verify", "POST", { code });

    setBusy(null);

    if (problem) {
      setError(problem);
      return;
    }

    setVerified(true);
    setCodeSent(false);
    setCode("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="email"
            required
            placeholder="parent@example.com"
            value={email}
            onChange={(event) => {
              setNote(null);
              setEmail(event.target.value);
            }}
            className="h-10 pl-9"
            aria-label="Contact email"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy !== null || !changed} className="rounded-full">
            {busy === "save" ? "Saving..." : "Save email"}
          </Button>

          {savedEmail ? (
            verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <BadgeCheck size={14} />
                Verified
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                Not verified yet
              </span>
            )
          ) : null}
        </div>
      </form>

      {savedEmail && !verified && !changed ? (
        <div className="anim-fade-up space-y-3 rounded-2xl border border-black/5 bg-[#F4F7F5] p-4">
          {!codeSent ? (
            <>
              <p className="text-sm text-slate-600">
                Verify this email so you can recover your password and get school notifications.
              </p>
              <Button type="button" onClick={sendCode} disabled={busy !== null} className="rounded-full">
                {busy === "send" ? "Sending..." : "Send verification code"}
              </Button>
            </>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <label htmlFor="verify-code" className="text-sm font-medium">
                Enter the 6-digit code
              </label>
              <Input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                className="h-11 max-w-[12rem] text-center font-mono text-xl tracking-[0.4em]"
                placeholder="000000"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={busy !== null || code.length !== 6} className="rounded-full">
                  {busy === "verify" ? "Checking..." : "Verify"}
                </Button>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy !== null}
                  className="text-sm text-[#0D5C63] hover:underline disabled:opacity-50"
                >
                  Send a new code
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        This email is shared by the parent for all their children at the school. Changing it means verifying
        it again.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
    </div>
  );
}
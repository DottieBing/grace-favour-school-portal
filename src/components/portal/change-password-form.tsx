"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { admissionNumberToEmail } from "@/lib/auth/student-login";
import { createClient } from "@/lib/supabase/client";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((open) => !open)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm({ admissionNumber }: { admissionNumber: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rules = [
    { ok: next.length >= 8, text: "At least 8 characters" },
    { ok: next !== "" && next !== current, text: "Different from the current one" },
    { ok: next !== "" && next === confirm, text: "Both new passwords match" },
  ];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (rules.some((rule) => !rule.ok)) {
      setError("Please meet all the requirements below the fields.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: admissionNumberToEmail(admissionNumber),
        password: current,
      });

      if (checkError) {
        setError("Your current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });

      if (updateError) {
        setError("We couldn't change the password. Please try again.");
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordField id="current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField id="next" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordField id="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

      <ul className="space-y-1">
        {rules.map((rule) => (
          <li
            key={rule.text}
            className={`flex items-center gap-2 text-xs transition-colors ${rule.ok ? "text-emerald-700" : "text-slate-400"}`}
          >
            <Check size={13} className={rule.ok ? "opacity-100" : "opacity-30"} />
            {rule.text}
          </li>
        ))}
      </ul>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {done ? (
        <p className="anim-pop rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Your password has been changed.
        </p>
      ) : null}

      <Button type="submit" disabled={saving} className="rounded-full">
        {saving ? "Saving..." : "Change password"}
      </Button>
    </form>
  );
}
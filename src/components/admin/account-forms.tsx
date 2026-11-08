"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function NameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name }),
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
    <form onSubmit={save} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="acc-name" className="text-sm font-medium">
          Display name
        </label>
        <Input
          id="acc-name"
          required
          value={name}
          onChange={(event) => {
            setSaved(false);
            setName(event.target.value);
          }}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || name.trim() === initialName}>
          {saving ? "Saving..." : "Save name"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
    </form>
  );
}

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
          className="pr-10"
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

export function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Staff logins can reach money and records, so the bar is higher than for students.
  const rules = [
    { ok: next.length >= 10, text: "At least 10 characters" },
    { ok: /[A-Za-z]/.test(next) && /\d/.test(next), text: "Contains a letter and a number" },
    { ok: next !== "" && next !== current, text: "Different from the current one" },
    { ok: next !== "" && next === confirm, text: "Both new passwords match" },
  ];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (rules.some((rule) => !rule.ok)) {
      setError("Please meet all the requirements listed below the fields.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { error: checkError } = await supabase.auth.signInWithPassword({
        email,
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
      <PasswordField id="acc-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField id="acc-next" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordField id="acc-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {done ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Your password has been changed.</p>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Change password"}
      </Button>
    </form>
  );
}
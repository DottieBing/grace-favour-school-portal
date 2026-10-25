"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGrid } from "@/components/users/permission-grid";
import type { Permissions } from "@/lib/auth/permissions";

export type TemplateOption = { id: string; name: string; permissions: Permissions };

type Created = { email: string; password: string; name: string; note: string | null };

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function AddUserForm({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [permissions, setPermissions] = useState<Permissions>({});
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  function applyTemplate(id: string) {
    const found = templates.find((item) => item.id === id);
    if (found) setPermissions({ ...found.permissions });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (Object.keys(permissions).length === 0) {
      setError("Tick at least one area.");
      return;
    }

    if (saveTemplate && templateName.trim() === "") {
      setError("Enter a name for the template, or untick the box.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, jobTitle, permissions }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        password?: string;
      };

      if (!response.ok || !data.password || !data.email) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      let note: string | null = null;

      if (saveTemplate) {
        const templateResponse = await fetch("/api/admin/users/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: templateName, permissions }),
        });

        if (!templateResponse.ok) {
          const info = (await templateResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          note = `The user was created, but the template wasn't saved: ${info.error ?? "unknown error"}`;
        }
      }

      setCreated({ email: data.email, password: data.password, name: fullName, note });
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLogin() {
    if (!created) return;
    await navigator.clipboard.writeText(
      `Email: ${created.email}\nPassword: ${created.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addAnother() {
    setFullName("");
    setEmail("");
    setJobTitle("");
    setPermissions({});
    setSaveTemplate(false);
    setTemplateName("");
    setCreated(null);
    setCopied(false);
  }

  if (created) {
    return (
      <div className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {created.name} can now sign in
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Copy these login details now. The password can&apos;t be shown again
            after you leave this page.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Email (username)</div>
            <div className="break-all font-mono text-slate-900">{created.email}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Initial password</div>
            <div className="break-all font-mono text-slate-900">{created.password}</div>
          </div>
        </div>

        {created.note ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{created.note}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={copyLogin} className="gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy login details"}
          </Button>
          <Button type="button" variant="outline" onClick={addAnother}>
            Add another user
          </Button>
          <Link
            href="/admin/users"
            className="inline-flex h-8 items-center rounded-md bg-[#0D5C63] px-3 text-sm font-medium text-white hover:bg-[#09494F]"
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-2xl space-y-8 rounded-xl border border-slate-200 bg-white p-6"
    >
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Person</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (their username)</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5 sm:w-1/2">
          <Label htmlFor="jobTitle">Job title (optional)</Label>
          <Input
            id="jobTitle"
            placeholder="e.g. Bursar"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Access</h2>
          {templates.length > 0 ? (
            <select
              className={`${selectClass} sm:w-56`}
              value=""
              onChange={(e) => applyTemplate(e.target.value)}
              aria-label="Start from a template"
            >
              <option value="">Start from a template...</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <PermissionGrid value={permissions} onChange={setPermissions} />

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              className="size-4"
              checked={saveTemplate}
              onChange={(e) => setSaveTemplate(e.target.checked)}
            />
            Save these ticks as a template
          </label>
          {saveTemplate ? (
            <Input
              placeholder="Template name, e.g. Bursar"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              maxLength={60}
            />
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Creating..." : "Create user"}
      </Button>
    </form>
  );
}
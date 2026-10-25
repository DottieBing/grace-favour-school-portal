"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGrid } from "@/components/users/permission-grid";
import type { TemplateOption } from "@/components/users/add-user-form";
import type { Permissions } from "@/lib/auth/permissions";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function EditAccessForm({
  userId,
  initialTitle,
  initialPermissions,
  templates,
}: {
  userId: string;
  initialTitle: string;
  initialPermissions: Permissions;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState(initialTitle);
  const [permissions, setPermissions] = useState<Permissions>(initialPermissions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaved(false);

    if (Object.keys(permissions).length === 0) {
      setError("Tick at least one area, or deactivate the user instead.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, permissions }),
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
    <div className="space-y-5">
      <div className="space-y-1.5 sm:w-1/2">
        <Label htmlFor="jobTitle">Job title</Label>
        <Input
          id="jobTitle"
          value={jobTitle}
          onChange={(e) => {
            setSaved(false);
            setJobTitle(e.target.value);
          }}
        />
      </div>

      {templates.length > 0 ? (
        <select
          className={selectClass}
          value=""
          onChange={(e) => {
            const found = templates.find((item) => item.id === e.target.value);
            if (found) {
              setSaved(false);
              setPermissions({ ...found.permissions });
            }
          }}
          aria-label="Fill from a template"
        >
          <option value="">Fill from a template...</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      ) : null}

      <PermissionGrid
        value={permissions}
        onChange={(next) => {
          setSaved(false);
          setPermissions(next);
        }}
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save access"}
        </Button>
        {saved ? (
          <span className="text-sm text-emerald-700">
            Saved. It applies the next time they load a page.
          </span>
        ) : null}
      </div>
    </div>
  );
}
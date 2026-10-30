"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALL_DAYS, DAY_NAMES } from "@/lib/timetable/time";

export type SettingsData = {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  admissionPrefix: string;
  timetableDays: number[];
  teacherClashCheck: boolean;
};

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const router = useRouter();
  const [values, setValues] = useState<SettingsData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSaved(false);
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function toggleDay(day: number) {
    set(
      "timetableDays",
      values.timetableDays.includes(day)
        ? values.timetableDays.filter((item) => item !== day)
        : [...values.timetableDays, day],
    );
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
    <form onSubmit={save} className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">School profile</h3>
        <div className="space-y-1.5">
          <Label htmlFor="s-name">School name</Label>
          <Input id="s-name" required value={values.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-motto">Motto (optional)</Label>
          <Input id="s-motto" value={values.motto} onChange={(e) => set("motto", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-address">Address (optional)</Label>
          <Input id="s-address" value={values.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-phone">Phone</Label>
            <Input id="s-phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">Email</Label>
            <Input id="s-email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-web">Website</Label>
            <Input id="s-web" value={values.website} onChange={(e) => set("website", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Admission numbers</h3>
        <div className="space-y-1.5 sm:w-1/3">
          <Label htmlFor="s-prefix">Prefix</Label>
          <Input
            id="s-prefix"
            required
            maxLength={8}
            value={values.admissionPrefix}
            onChange={(e) => set("admissionPrefix", e.target.value.toUpperCase())}
          />
        </div>
        <p className="text-xs text-slate-500">
          2 to 8 letters. New students get numbers like {values.admissionPrefix || "GFMS"}2627001.
          Numbers already issued never change, and their logins keep working.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Timetable</h3>
        <div>
          <p className="mb-2 text-sm text-slate-700">Days the school teaches</p>
          <div className="flex flex-wrap gap-3">
            {ALL_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={values.timetableDays.includes(day)}
                  onChange={() => toggleDay(day)}
                />
                {DAY_NAMES[day]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Attendance registers are still Monday to Friday only.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-900">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={values.teacherClashCheck}
            onChange={(e) => set("teacherClashCheck", e.target.checked)}
          />
          <span>
            Stop a teacher being booked in two classes at the same time
            <span className="block text-xs text-slate-500">
              Turn this off if you want full freedom, for example for team teaching.
            </span>
          </span>
        </label>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
    </form>
  );
}
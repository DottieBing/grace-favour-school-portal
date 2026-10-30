"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DeleteButton } from "@/components/admin/action-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Holiday = { id: string; name: string; start: string; end: string };

function fmt(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function HolidayManager({ holidays }: { holidays: Holiday[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate: start, endDate: end }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setName("");
      setStart("");
      setEnd("");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="h-name">Holiday</Label>
          <Input id="h-name" required placeholder="e.g. Independence Day" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="h-start">From</Label>
          <Input id="h-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="h-end">To (optional)</Label>
          <Input id="h-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add"}
        </Button>
      </form>

      {error ? (
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {holidays.length === 0 ? (
        <p className="text-sm text-slate-500">No holidays added yet.</p>
      ) : (
        <ul className="max-w-2xl divide-y divide-slate-100 rounded-lg border border-slate-200">
          {holidays.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.start === item.end ? fmt(item.start) : `${fmt(item.start)} to ${fmt(item.end)}`}
                </p>
              </div>
              <DeleteButton
                url={`/api/admin/settings/holidays/${item.id}`}
                title={`Delete "${item.name}"?`}
                description="Attendance can be marked on those days again."
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
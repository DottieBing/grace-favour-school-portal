"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DAY_NAMES } from "@/lib/timetable/time";
import type { PeriodInfo } from "@/lib/timetable/types";

export function PeriodSheet({
  scheduleId,
  period,
  dayChoices,
}: {
  scheduleId: string;
  period?: PeriodInfo;
  dayChoices: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [allDays, setAllDays] = useState(true);
  const [days, setDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    setName(period?.name ?? "");
    setStart(period?.start ?? "");
    setEnd(period?.end ?? "");
    setIsBreak(period?.isBreak ?? false);
    setAllDays(!period?.days);
    setDays(period?.days ?? []);
    setError(null);
    setOpen(true);
  }

  function toggle(day: number) {
    setDays((previous) =>
      previous.includes(day) ? previous.filter((item) => item !== day) : [...previous, day],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!allDays && days.length === 0) {
      setError("Choose at least one day, or tick All days.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        startTime: start,
        endTime: end,
        isBreak,
        days: allDays ? null : days,
      };

      const response = await fetch(
        period ? `/api/admin/timetable/periods/${period.id}` : "/api/admin/timetable/periods",
        {
          method: period ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(period ? payload : { ...payload, scheduleId }),
        },
      );

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
      {period ? (
        <Button type="button" size="sm" variant="outline" onClick={openSheet}>
          Edit
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={openSheet} className="gap-1.5">
          <Plus className="size-4" />
          Add period
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} className="space-y-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>{period ? "Edit period" : "Add period"}</SheetTitle>
              <SheetDescription>
                Periods in a schedule can't overlap on the same day.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" required placeholder="e.g. Period 1, Lunch" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-start">Starts</Label>
                <Input id="p-start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-end">Ends</Label>
                <Input id="p-end" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-900">
              <input type="checkbox" className="mt-0.5 size-4" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
              <span>
                This is a break
                <span className="block text-xs text-slate-500">
                  No lesson is scheduled. Saving clears any lessons already placed here.
                </span>
              </span>
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input type="checkbox" className="size-4" checked={allDays} onChange={(e) => setAllDays(e.target.checked)} />
                Runs on all school days
              </label>
              {!allDays ? (
                <div className="flex flex-wrap gap-3">
                  {dayChoices.map((day) => (
                    <label key={day} className="flex items-center gap-2 text-sm text-slate-900">
                      <input type="checkbox" className="size-4" checked={days.includes(day)} onChange={() => toggle(day)} />
                      {DAY_NAMES[day]}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save period"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
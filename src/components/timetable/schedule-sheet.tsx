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

export function ScheduleSheet({ schedule }: { schedule?: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        schedule
          ? `/api/admin/timetable/schedules/${schedule.id}`
          : "/api/admin/timetable/schedules",
        {
          method: schedule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
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
      {schedule ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setName(schedule.name);
            setError(null);
            setOpen(true);
          }}
        >
          Rename
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => {
            setName("");
            setError(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" />
          New schedule
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} className="space-y-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>{schedule ? "Rename schedule" : "New schedule"}</SheetTitle>
              <SheetDescription>
                A school day's periods. Make one for each group that runs a
                different day, such as Nursery and Primary.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="sch-name">Name</Label>
              <Input id="sch-name" required placeholder="e.g. Primary" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
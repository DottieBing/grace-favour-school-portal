"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiError = { error?: string };

export function SetCurrentButton({
  termId,
  label,
}: {
  termId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/terms/${termId}/current`, {
        method: "POST",
      });

      const data = (await response.json().catch(() => ({}))) as ApiError;

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
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Set as current
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make {label} the current term?</DialogTitle>
            <DialogDescription>
              New attendance, results and fees will attach to this term. The
              previous current term and session stop being current.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={saving}>
              {saving ? "Saving..." : "Make current"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditTermDatesButton({
  termId,
  label,
  startDate,
  endDate,
}: {
  termId: string;
  label: string;
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  function openDialog() {
    setStart(startDate);
    setEnd(endDate);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/terms/${termId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, endDate: end }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiError;

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
      <Button type="button" size="sm" variant="outline" onClick={openDialog}>
        Edit dates
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {label} dates</DialogTitle>
            <DialogDescription>
              Dates can&apos;t overlap the neighbouring terms.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`start-${termId}`}>Starts</Label>
              <Input
                id={`start-${termId}`}
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`end-${termId}`}>Ends</Label>
              <Input
                id={`end-${termId}`}
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={saving || !start || !end}
            >
              {saving ? "Saving..." : "Save dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
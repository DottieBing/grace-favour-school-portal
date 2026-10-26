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

export function GenerateCharges({
  classId,
  termId,
  className,
  termLabel,
}: {
  classId: string;
  termId: string;
  className: string;
  termLabel: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"class" | "all" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);

  function close() {
    if (saving) return;
    setScope(null);
    setError(null);
    setCreated(null);
  }

  async function confirm() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/fees/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope === "class" ? { termId, classId } : { termId }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        created?: number;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setCreated(data.created ?? 0);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => setScope("class")}>
          Charge {className}
        </Button>
        <Button type="button" variant="outline" onClick={() => setScope("all")}>
          Charge all classes
        </Button>
      </div>

      <Dialog open={scope !== null} onOpenChange={(value) => !value && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {created === null
                ? `Charge ${scope === "all" ? "all classes" : className} for ${termLabel}?`
                : "Charges generated"}
            </DialogTitle>
            <DialogDescription>
              {created === null
                ? "Each active student is charged their class's total from the saved structure. Students already charged for this term are skipped, and existing charges never change."
                : created === 0
                  ? "Nobody new was charged. Either everyone already has a charge, or no fees are saved for that class and term."
                  : `${created} student${created === 1 ? " was" : "s were"} charged.`}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            {created === null ? (
              <>
                <Button type="button" variant="outline" onClick={close} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={confirm} disabled={saving}>
                  {saving ? "Generating..." : "Generate charges"}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={close}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
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

export function ConfirmStatusButton({
  url,
  name,
  isActive,
  deactivateMessage,
  reactivateMessage,
}: {
  url: string;
  name: string;
  isActive: boolean;
  deactivateMessage: string;
  reactivateMessage: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

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
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isActive ? "Deactivate" : "Reactivate"} {name}?
            </DialogTitle>
            <DialogDescription>
              {isActive ? deactivateMessage : reactivateMessage}
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
            <Button
              type="button"
              variant={isActive ? "destructive" : "default"}
              onClick={confirm}
              disabled={saving}
            >
              {saving ? "Saving..." : isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
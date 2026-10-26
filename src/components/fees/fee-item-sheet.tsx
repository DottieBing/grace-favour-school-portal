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

export type FeeItemData = { id: string; name: string; description: string };

export function FeeItemSheet({ item }: { item?: FeeItemData }) {
  const router = useRouter();
  const editing = Boolean(item);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        item ? `/api/admin/fees/items/${item.id}` : "/api/admin/fees/items",
        {
          method: item ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
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
      {editing ? (
        <Button type="button" size="sm" variant="outline" onClick={openSheet}>
          Edit
        </Button>
      ) : (
        <Button type="button" onClick={openSheet} className="gap-2">
          <Plus className="size-4" />
          Add item
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} className="space-y-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>{editing ? "Edit fee item" : "Add fee item"}</SheetTitle>
              <SheetDescription>
                Something the school charges for, like Tuition or Books. Amounts
                are set per class on the structure below.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="fee-name">Name</Label>
              <Input
                id="fee-name"
                placeholder="e.g. Tuition"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fee-description">Description (optional)</Label>
              <Input
                id="fee-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : editing ? "Save changes" : "Add item"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
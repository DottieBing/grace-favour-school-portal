"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { LEVELS, buildClassName } from "@/lib/academic/levels";

export type ClassData = {
  id: string;
  levelNumber: number;
  section: string;
  capacity: number | null;
};

type FormValues = { levelNumber: string; section: string; capacity: string };

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function ClassSheet({ cls }: { cls?: ClassData }) {
  const router = useRouter();
  const editing = Boolean(cls);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: FormValues = {
    levelNumber: cls ? String(cls.levelNumber) : "1",
    section: cls?.section ?? "",
    capacity: cls?.capacity ? String(cls.capacity) : "",
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: defaults });

  const preview = buildClassName(
    Number(watch("levelNumber")),
    watch("section").trim().toUpperCase() || null,
  );

  function openSheet() {
    reset(defaults);
    setServerError(null);
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const capacity = values.capacity.trim() === "" ? null : Number(values.capacity);

    const body = cls
      ? { section: values.section, capacity }
      : {
          levelNumber: Number(values.levelNumber),
          section: values.section,
          capacity,
        };

    try {
      const response = await fetch(
        cls ? `/api/admin/classes/${cls.id}` : "/api/admin/classes",
        {
          method: cls ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setServerError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Network error. Check your connection and try again.");
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
          Add class
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 px-4 pb-6"
          >
            <SheetHeader className="px-0">
              <SheetTitle>{editing ? "Edit class" : "Add class"}</SheetTitle>
              <SheetDescription>
                Leave the arm blank if the level has only one class. Add a
                letter (A, B, C) when it has several.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="class-level">Level</Label>
              <select
                id="class-level"
                disabled={editing}
                className={selectClass}
                {...register("levelNumber")}
              >
                {LEVELS.map((level) => (
                  <option key={level.number} value={level.number}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="class-section">Arm (optional)</Label>
                <Input
                  id="class-section"
                  maxLength={1}
                  placeholder="A"
                  {...register("section")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class-capacity">Capacity (optional)</Label>
                <Input
                  id="class-capacity"
                  type="number"
                  min={1}
                  max={200}
                  {...register("capacity")}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Will be saved as </span>
              <span className="font-semibold text-slate-900">{preview}</span>
            </div>

            {serverError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {serverError}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add class"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
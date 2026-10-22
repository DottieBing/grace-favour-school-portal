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

export type ComponentData = { id: string; name: string; maxScore: number };

type FormValues = { name: string; maxScore: string };

export function ComponentSheet({ component }: { component?: ComponentData }) {
  const router = useRouter();
  const editing = Boolean(component);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: FormValues = {
    name: component?.name ?? "",
    maxScore: component ? String(component.maxScore) : "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: defaults });

  function openSheet() {
    reset(defaults);
    setServerError(null);
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const maxScore = Number(values.maxScore);

    if (!Number.isFinite(maxScore)) {
      setServerError("Enter the maximum score as a number.");
      return;
    }

    try {
      const response = await fetch(
        component
          ? `/api/admin/grading/components/${component.id}`
          : "/api/admin/grading/components",
        {
          method: component ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: values.name, maxScore }),
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
          Add component
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>
                {editing ? "Edit component" : "Add component"}
              </SheetTitle>
              <SheetDescription>
                A part of a student&apos;s score, like &quot;CA 1&quot; or
                &quot;Exam&quot;, and the most marks it can earn.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="component-name">Name</Label>
              <Input
                id="component-name"
                placeholder="e.g. Exam"
                required
                {...register("name")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="component-max">Maximum score</Label>
              <Input
                id="component-max"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 60"
                required
                {...register("maxScore")}
              />
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
                {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add component"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
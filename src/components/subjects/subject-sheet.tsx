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

export type SubjectData = {
  id: string;
  name: string;
  code: string;
  description: string;
};

type FormValues = { name: string; code: string; description: string };

export function SubjectSheet({ subject }: { subject?: SubjectData }) {
  const router = useRouter();
  const editing = Boolean(subject);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: FormValues = {
    name: subject?.name ?? "",
    code: subject?.code ?? "",
    description: subject?.description ?? "",
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

    try {
      const response = await fetch(
        subject ? `/api/admin/subjects/${subject.id}` : "/api/admin/subjects",
        {
          method: subject ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
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
          Add subject
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 px-4 pb-6"
          >
            <SheetHeader className="px-0">
              <SheetTitle>{editing ? "Edit subject" : "Add subject"}</SheetTitle>
              <SheetDescription>
                {editing
                  ? "Renaming a subject updates it everywhere, including old records."
                  : "Add a subject your school teaches."}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="subject-name">Subject name</Label>
              <Input
                id="subject-name"
                placeholder="e.g. Mathematics"
                required
                {...register("name")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject-code">Code (optional)</Label>
              <Input
                id="subject-code"
                placeholder="e.g. MTH"
                maxLength={10}
                {...register("code")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject-description">
                Description (optional)
              </Label>
              <Input id="subject-description" {...register("description")} />
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
                {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add subject"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
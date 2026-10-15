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

type FormValues = {
  name: string;
  t1Start: string;
  t1End: string;
  t2Start: string;
  t2End: string;
  t3Start: string;
  t3End: string;
};

const TERMS = [
  { label: "First term", start: "t1Start", end: "t1End" },
  { label: "Second term", start: "t2Start", end: "t2End" },
  { label: "Third term", start: "t3Start", end: "t3End" },
] as const;

function emptyForm(): FormValues {
  const year = new Date().getFullYear();

  return {
    name: `${year}/${year + 1}`,
    t1Start: "",
    t1End: "",
    t2Start: "",
    t2End: "",
    t3Start: "",
    t3End: "",
  };
}

export function CreateSessionSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: emptyForm() });

  function openSheet() {
    reset(emptyForm());
    setServerError(null);
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const body = {
      name: values.name,
      terms: [
        { startDate: values.t1Start, endDate: values.t1End },
        { startDate: values.t2Start, endDate: values.t2End },
        { startDate: values.t3Start, endDate: values.t3End },
      ],
    };

    try {
      const response = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

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
      <Button type="button" onClick={openSheet} className="gap-2">
        <Plus className="size-4" />
        New session
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 px-4 pb-6"
          >
            <SheetHeader className="px-0">
              <SheetTitle>New academic session</SheetTitle>
              <SheetDescription>
                The three terms are created together. You can adjust dates
                later.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor="name">Session</Label>
              <Input
                id="name"
                placeholder="2026/2027"
                required
                {...register("name")}
              />
            </div>

            {TERMS.map((term) => (
              <div key={term.label} className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  {term.label}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={term.start}>Starts</Label>
                    <Input
                      id={term.start}
                      type="date"
                      required
                      {...register(term.start)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={term.end}>Ends</Label>
                    <Input
                      id={term.end}
                      type="date"
                      required
                      {...register(term.end)}
                    />
                  </div>
                </div>
              </div>
            ))}

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
                {isSubmitting ? "Creating..." : "Create session"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
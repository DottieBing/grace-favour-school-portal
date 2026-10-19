"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Pencil } from "lucide-react";

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

export type EditableStaff = {
  id: string;
  hasLogin: boolean;
  fullName: string;
  jobTitle: string;
  department: string;
  phone: string;
  email: string;
  employmentDate: string;
  gender: "" | "male" | "female";
  dateOfBirth: string;
  address: string;
  qualification: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

type FormValues = Omit<EditableStaff, "id" | "hasLogin">;

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EditStaffSheet({ staff }: { staff: EditableStaff }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { id, hasLogin, ...defaults } = staff;

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
      const response = await fetch(`/api/admin/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
      <Button type="button" variant="outline" onClick={openSheet} className="gap-2">
        <Pencil className="size-4" />
        Edit details
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 px-4 pb-6"
          >
            <SheetHeader className="px-0">
              <SheetTitle>Edit staff details</SheetTitle>
              <SheetDescription>
                The staff number can&apos;t be changed.
              </SheetDescription>
            </SheetHeader>

            <Field label="Full name" htmlFor="fullName">
              <Input id="fullName" required {...register("fullName")} />
            </Field>

            <Field label="Job title" htmlFor="jobTitle">
              <Input id="jobTitle" required {...register("jobTitle")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Employment date" htmlFor="employmentDate">
                <Input
                  id="employmentDate"
                  type="date"
                  required
                  {...register("employmentDate")}
                />
              </Field>
              <Field label="Department" htmlFor="department">
                <Input id="department" {...register("department")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender" htmlFor="gender">
                <select
                  id="gender"
                  className={selectClass}
                  {...register("gender")}
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
              <Field label="Date of birth" htmlFor="dateOfBirth">
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...register("dateOfBirth")}
                />
              </Field>
            </div>

            <Field label="Phone" htmlFor="phone">
              <Input id="phone" type="tel" {...register("phone")} />
            </Field>

            <Field
              label="Email"
              htmlFor="email"
              hint={
                hasLogin
                  ? "This is the teacher's login email and can't be changed here."
                  : undefined
              }
            >
              <Input
                id="email"
                type="email"
                disabled={hasLogin}
                {...register("email")}
              />
            </Field>

            <Field label="Address" htmlFor="address">
              <Input id="address" {...register("address")} />
            </Field>

            <Field label="Qualification" htmlFor="qualification">
              <Input
                id="qualification"
                placeholder="e.g. B.Ed Primary Education"
                {...register("qualification")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Emergency contact" htmlFor="emergencyContactName">
                <Input
                  id="emergencyContactName"
                  {...register("emergencyContactName")}
                />
              </Field>
              <Field label="Emergency phone" htmlFor="emergencyContactPhone">
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  {...register("emergencyContactPhone")}
                />
              </Field>
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
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
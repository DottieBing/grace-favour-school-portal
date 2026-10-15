"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, Plus, RefreshCw } from "lucide-react";

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

const formSchema = z
  .object({
    staffType: z.enum(["teaching", "non_teaching"]),
    fullName: z.string().trim().min(2, "Enter the full name."),
    staffNumber: z.string().trim().min(2, "Enter a staff number."),
    jobTitle: z.string().trim().min(2, "Enter a job title."),
    employmentDate: z.string().date("Pick a valid employment date."),
    email: z.string().trim(),
    password: z.string(),
    phone: z.string().trim(),
    department: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const emailOk = z.email().safeParse(values.email).success;

    if (values.staffType === "teaching") {
      if (!emailOk) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Enter a valid email for the teacher's login.",
        });
      }
      if (values.password.length < 12) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password must be at least 12 characters.",
        });
      }
    } else {
      if (values.department.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["department"],
          message: "Enter a department.",
        });
      }
      if (values.email && !emailOk) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Enter a valid email or leave it blank.",
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

function generatePassword(length = 16) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function emptyForm(): FormValues {
  return {
    staffType: "teaching",
    fullName: "",
    staffNumber: "",
    jobTitle: "",
    employmentDate: new Date().toISOString().slice(0, 10),
    email: "",
    password: "",
    phone: "",
    department: "",
  };
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function CreateStaffSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyForm(),
  });

  const staffType = watch("staffType");
  const isTeaching = staffType === "teaching";

  function openSheet() {
    reset(emptyForm());
    setValue("password", generatePassword());
    setServerError(null);
    setCreated(null);
    setCopied(false);
    setOpen(true);
  }

  function closeSheet() {
    setOpen(false);
    setCreated(null);
  }

  function chooseType(type: FormValues["staffType"]) {
    setValue("staffType", type);
    clearErrors();
  }

  async function copyLogin() {
    if (!created) return;
    await navigator.clipboard.writeText(
      `Email: ${created.email}\nPassword: ${created.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const teaching = values.staffType === "teaching";
    const url = teaching
      ? "/api/admin/teachers"
      : "/api/admin/non-teaching-staff";

    const body = teaching
      ? {
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          staffNumber: values.staffNumber,
          jobTitle: values.jobTitle,
          employmentDate: values.employmentDate,
        }
      : {
          fullName: values.fullName,
          staffNumber: values.staffNumber,
          jobTitle: values.jobTitle,
          department: values.department,
          phone: values.phone || undefined,
          email: values.email,
          employmentDate: values.employmentDate,
        };

    try {
      const response = await fetch(url, {
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

      router.refresh();

      if (teaching) {
        setCreated({
          name: values.fullName,
          email: values.email,
          password: values.password,
        });
      } else {
        closeSheet();
      }
    } catch {
      setServerError("Network error. Check your connection and try again.");
    }
  }

  const toggleBase =
    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors";

  return (
    <>
      <Button onClick={openSheet} className="gap-2">
        <Plus className="size-4" />
        Add staff
      </Button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : closeSheet())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {created ? (
            <div className="space-y-6 px-4 pb-6">
              <SheetHeader className="px-0">
                <SheetTitle>Teacher account created</SheetTitle>
                <SheetDescription>
                  Copy these login details now. The password can&apos;t be shown
                  again after you close this panel.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Name</div>
                  <div className="font-medium text-slate-900">
                    {created.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="font-mono text-slate-900">{created.email}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Initial password</div>
                  <div className="break-all font-mono text-slate-900">
                    {created.password}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyLogin}
                  className="flex-1 gap-2"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy login details"}
                </Button>
                <Button type="button" onClick={closeSheet} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5 px-4 pb-6"
              noValidate
            >
              <SheetHeader className="px-0">
                <SheetTitle>Add staff</SheetTitle>
                <SheetDescription>
                  Teachers get a portal login. Non-teaching staff only get a
                  profile.
                </SheetDescription>
              </SheetHeader>

              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => chooseType("teaching")}
                  className={`${toggleBase} ${
                    isTeaching
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Teaching
                </button>
                <button
                  type="button"
                  onClick={() => chooseType("non_teaching")}
                  className={`${toggleBase} ${
                    !isTeaching
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Non-teaching
                </button>
              </div>

              <Field
                label="Full name"
                htmlFor="fullName"
                error={errors.fullName?.message}
              >
                <Input id="fullName" {...register("fullName")} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Staff number"
                  htmlFor="staffNumber"
                  error={errors.staffNumber?.message}
                >
                  <Input id="staffNumber" {...register("staffNumber")} />
                </Field>
                <Field
                  label="Employment date"
                  htmlFor="employmentDate"
                  error={errors.employmentDate?.message}
                >
                  <Input
                    id="employmentDate"
                    type="date"
                    {...register("employmentDate")}
                  />
                </Field>
              </div>

              <Field
                label="Job title"
                htmlFor="jobTitle"
                error={errors.jobTitle?.message}
              >
                <Input
                  id="jobTitle"
                  placeholder={
                    isTeaching ? "e.g. Primary 3 Teacher" : "e.g. Bursar"
                  }
                  {...register("jobTitle")}
                />
              </Field>

              {!isTeaching ? (
                <>
                  <Field
                    label="Department"
                    htmlFor="department"
                    error={errors.department?.message}
                  >
                    <Input
                      id="department"
                      placeholder="e.g. Administration, Security"
                      {...register("department")}
                    />
                  </Field>
                  <Field
                    label="Phone (optional)"
                    htmlFor="phone"
                    error={errors.phone?.message}
                  >
                    <Input id="phone" type="tel" {...register("phone")} />
                  </Field>
                </>
              ) : null}

              <Field
                label={isTeaching ? "Login email" : "Email (optional)"}
                htmlFor="email"
                error={errors.email?.message}
              >
                <Input id="email" type="email" {...register("email")} />
              </Field>

              {isTeaching ? (
                <Field
                  label="Initial password"
                  htmlFor="password"
                  error={errors.password?.message}
                >
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type="text"
                      autoComplete="off"
                      className="font-mono"
                      {...register("password")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Generate a new password"
                      onClick={() => setValue("password", generatePassword())}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {watch("password").length} characters. You&apos;ll be able
                    to copy it after saving.
                  </p>
                </Field>
              ) : null}

              {serverError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {serverError}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeSheet}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Saving..." : "Save staff"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
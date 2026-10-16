"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ClassOption = {
  id: string;
  name: string;
  count: number;
  capacity: number | null;
};

type FormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "" | "male" | "female";
  admissionSession: string;
  admissionDate: string;
  classId: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship: "" | "Mother" | "Father" | "Guardian" | "Other";
};

type Registered = {
  admissionNumber: string;
  password: string;
  studentName: string;
  guardianName: string;
  guardianReused: boolean;
};

const selectClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function RegisterStudentForm({
  classes,
  sessionNames,
  defaultSession,
}: {
  classes: ClassOption[];
  sessionNames: string[];
  defaultSession: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [copied, setCopied] = useState(false);

  function emptyForm(): FormValues {
    return {
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      admissionSession: defaultSession,
      admissionDate: new Date().toISOString().slice(0, 10),
      classId: "",
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
    };
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: emptyForm() });

  async function onSubmit(values: FormValues) {
    setServerError(null);

    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<Registered> & {
        error?: string;
      };

      if (!response.ok || !data.admissionNumber || !data.password) {
        setServerError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setRegistered({
        admissionNumber: data.admissionNumber,
        password: data.password,
        studentName: data.studentName ?? "",
        guardianName: data.guardianName ?? "",
        guardianReused: Boolean(data.guardianReused),
      });
      router.refresh();
    } catch {
      setServerError("Network error. Check your connection and try again.");
    }
  }

  async function copyLogin() {
    if (!registered) return;
    await navigator.clipboard.writeText(
      `Admission number: ${registered.admissionNumber}\nPassword: ${registered.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function registerAnother() {
    reset(emptyForm());
    setRegistered(null);
    setServerError(null);
    setCopied(false);
  }

  if (registered) {
    return (
      <div className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {registered.studentName} is registered
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Copy these login details now. The password can&apos;t be shown again
            after you leave this page.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Admission number (username)</div>
            <div className="font-mono text-base text-slate-900">
              {registered.admissionNumber}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Initial password</div>
            <div className="break-all font-mono text-base text-slate-900">
              {registered.password}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Guardian</div>
            <div className="text-slate-900">
              {registered.guardianName}
              {registered.guardianReused
                ? " (linked to an existing guardian record)"
                : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={copyLogin} className="gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy login details"}
          </Button>
          <Button type="button" onClick={registerAnother}>
            Register another student
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-2xl space-y-8 rounded-xl border border-slate-200 bg-white p-6"
    >
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Student</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" htmlFor="firstName">
            <Input id="firstName" required {...register("firstName")} />
          </Field>
          <Field label="Middle name" htmlFor="middleName">
            <Input id="middleName" {...register("middleName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName">
            <Input id="lastName" required {...register("lastName")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="dateOfBirth">
            <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
          </Field>
          <Field label="Gender" htmlFor="gender">
            <select id="gender" className={selectClass} {...register("gender")}>
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Admission</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Admission session" htmlFor="admissionSession">
            <Input
              id="admissionSession"
              list="session-options"
              placeholder="2026/2027"
              required
              {...register("admissionSession")}
            />
            <datalist id="session-options">
              {sessionNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="Admission date" htmlFor="admissionDate">
            <Input
              id="admissionDate"
              type="date"
              required
              {...register("admissionDate")}
            />
          </Field>
          <Field label="Class" htmlFor="classId">
            <select
              id="classId"
              required
              className={selectClass}
              {...register("classId")}
            >
              <option value="">Choose a class...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.count}
                  {item.capacity ? `/${item.capacity}` : ""})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          The admission number comes from the admission session. A student
          admitted in 2026/2027 gets a number like GFMS2627001.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Parent or guardian
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="guardianName">
            <Input id="guardianName" required {...register("guardianName")} />
          </Field>
          <Field label="Phone number" htmlFor="guardianPhone">
            <Input
              id="guardianPhone"
              type="tel"
              required
              {...register("guardianPhone")}
            />
          </Field>
        </div>

        <div className="sm:w-1/2">
          <Field label="Relationship" htmlFor="guardianRelationship">
            <select
              id="guardianRelationship"
              className={selectClass}
              {...register("guardianRelationship")}
            >
              <option value="">Not set</option>
              <option value="Mother">Mother</option>
              <option value="Father">Father</option>
              <option value="Guardian">Guardian</option>
              <option value="Other">Other</option>
            </select>
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          If this phone number already belongs to a guardian, the student is
          linked to that guardian, so siblings share one record. The parent adds
          their own email later, when they change their password.
        </p>
      </section>

      {serverError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Registering..." : "Register student"}
      </Button>
    </form>
  );
}
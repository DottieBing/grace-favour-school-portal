import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatLongDate,
  isWeekday,
  todayInSchool,
} from "@/lib/attendance/dates";
import { loadRegisters } from "@/lib/attendance/load";
import { findTermForDate } from "@/lib/attendance/terms";
import { RegisterForm } from "@/components/attendance/register-form";

function Shell({
  date,
  title,
  children,
}: {
  date: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 p-6">
      <Link
        href={`/admin/attendance?date=${date}`}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to attendance
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{formatLongDate(date)}</p>
      </div>

      {children}
    </div>
  );
}

async function ClassRegisterContent({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAreaAccess("attendance");

  const { classId } = await params;
  const { date: requested } = await searchParams;

  if (!z.uuid().safeParse(classId).success) {
    notFound();
  }

  const today = todayInSchool();
  const parsed = z.string().date().safeParse(requested);
  const date = parsed.success && parsed.data <= today ? parsed.data : today;

  const admin = createAdminClient();

  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    console.error("Unable to load class:", classError.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this class. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!cls) {
    notFound();
  }

  const className = cls.name as string;

  let blocked: string | null = null;

  if (!isWeekday(date)) {
    blocked = "That day is a weekend, so there's no register.";
  } else {
    const lookup = await findTermForDate(admin, date);

    if (!lookup.ok) {
      blocked = "We couldn't check the school term. Please refresh the page.";
    } else if (!lookup.term) {
      blocked = "That date isn't within a school term, so there's no register.";
    }
  }

  if (blocked) {
    return (
      <Shell date={date} title={className}>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {blocked}
        </div>
      </Shell>
    );
  }

  const data = await loadRegisters(admin, [classId], date);
  const entry = data?.get(classId);

  if (!entry) {
    return (
      <Shell date={date} title={className}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the register. Please refresh the page.
        </div>
      </Shell>
    );
  }

  const status = entry.register?.status;

  return (
    <Shell date={date} title={className}>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              status === "submitted"
                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                : status === "reopened"
                  ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                  : "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
            }
          >
            {status === "submitted"
              ? "Submitted"
              : status === "reopened"
                ? "Reopened"
                : "Not submitted"}
          </span>
        </div>

        {status === "submitted" ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            This register is submitted. Saving changes will correct it, and the
            correction is recorded.
          </p>
        ) : null}

        {entry.students.length === 0 ? (
          <p className="text-sm text-slate-500">
            There are no active students in this class.
          </p>
        ) : (
          <RegisterForm
            key={`${classId}-${date}`}
            classId={classId}
            date={date}
            students={entry.students}
            initial={entry.marks}
            endpoint="/api/admin/attendance"
            sendDate
            submitLabel="Save register"
          />
        )}
      </section>
    </Shell>
  );
}

function ClassRegisterFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function AdminClassRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  return (
    <Suspense fallback={<ClassRegisterFallback />}>
      <ClassRegisterContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
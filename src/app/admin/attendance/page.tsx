import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatLongDate,
  isWeekday,
  todayInSchool,
} from "@/lib/attendance/dates";
import { findTermForDate } from "@/lib/attendance/terms";
import { DatePicker } from "@/components/attendance/date-picker";
import { ReopenButton } from "@/components/attendance/reopen-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/admin/clickable-row";

const linkClass =
  "inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50";

async function OverviewContent({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { canManage } = await requireAreaAccess("attendance");

  const { date: requested } = await searchParams;
  const today = todayInSchool();
  const parsed = z.string().date().safeParse(requested);
  const date = parsed.success && parsed.data <= today ? parsed.data : today;

  const admin = createAdminClient();

  let blocked: string | null = null;

  if (!isWeekday(date)) {
    blocked = "That day is a weekend, so there are no registers.";
  } else {
    const lookup = await findTermForDate(admin, date);

    if (!lookup.ok) {
      blocked = "We couldn't check the school term. Please refresh the page.";
    } else if (!lookup.term) {
      blocked = "That date isn't within a school term, so there are no registers.";
    }
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">{formatLongDate(date)}</p>
      </div>
      <div className="flex items-center gap-2">
        <DatePicker value={date} max={today} />
        {date !== today ? (
          <Link href="/admin/attendance" className={linkClass}>
            Today
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (blocked) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {blocked}
        </div>
      </div>
    );
  }

  const [classesResult, studentsResult, registersResult] = await Promise.all([
    admin
      .from("classes")
      .select("id, name")
      .eq("is_active", true)
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin
      .from("students")
      .select("current_class_id")
      .eq("status", "active")
      .not("current_class_id", "is", null),
    admin
      .from("attendance_registers")
      .select("id, class_id, status")
      .eq("attendance_date", date),
  ]);

  const failed =
    classesResult.error ?? studentsResult.error ?? registersResult.error;

  const registerIds = (registersResult.data ?? []).map((item) => item.id as string);

  let recordRows: { register_id: string; status: string }[] = [];
  let recordsFailed = false;

  if (!failed && registerIds.length > 0) {
    const { data, error } = await admin
      .from("attendance_records")
      .select("register_id, status")
      .in("register_id", registerIds);

    if (error) {
      console.error("Unable to load attendance marks:", error.message);
      recordsFailed = true;
    } else {
      recordRows = (data ?? []) as typeof recordRows;
    }
  }

  if (failed || recordsFailed) {
    if (failed) console.error("Unable to load attendance:", failed.message);

    return (
      <div className="space-y-6 p-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load attendance. Please refresh the page.
        </div>
      </div>
    );
  }

  const enrolled = new Map<string, number>();

  for (const row of studentsResult.data ?? []) {
    const classId = row.current_class_id as string;
    enrolled.set(classId, (enrolled.get(classId) ?? 0) + 1);
  }

  const registerByClass = new Map(
    (registersResult.data ?? []).map((item) => [
      item.class_id as string,
      { id: item.id as string, status: item.status as "submitted" | "reopened" },
    ]),
  );

  const tallies = new Map<string, { present: number; absent: number; late: number }>();

  for (const row of recordRows) {
    const tally = tallies.get(row.register_id) ?? { present: 0, absent: 0, late: 0 };

    if (row.status === "present") tally.present += 1;
    else if (row.status === "absent") tally.absent += 1;
    else if (row.status === "late") tally.late += 1;

    tallies.set(row.register_id, tally);
  }

  const classes = (classesResult.data ?? []).filter(
    (item) => (enrolled.get(item.id as string) ?? 0) > 0,
  );

  const submittedCount = classes.filter(
    (item) => registerByClass.get(item.id as string)?.status === "submitted",
  ).length;

  return (
    <div className="space-y-6 p-6">
      {header}

      <p className="text-sm text-slate-600">
        {submittedCount} of {classes.length} class
        {classes.length === 1 ? "" : "es"} with students have submitted.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Marks</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No class has active students yet.
                </TableCell>
              </TableRow>
            ) : (
              classes.map((item) => {
                const classId = item.id as string;
                const register = registerByClass.get(classId);
                const tally = register ? tallies.get(register.id) : undefined;
                const href = `/admin/attendance/${classId}?date=${date}`;

                return (
                  <ClickableRow key={classId} href={href}>
                    <TableCell className="font-medium text-slate-900">
                      {item.name as string}
                    </TableCell>
                    <TableCell>{enrolled.get(classId) ?? 0}</TableCell>
                    <TableCell>
                      <span
                        className={
                          register?.status === "submitted"
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : register?.status === "reopened"
                              ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                              : "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                        }
                      >
                        {register?.status === "submitted"
                          ? "Submitted"
                          : register?.status === "reopened"
                            ? "Reopened"
                            : "Not submitted"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {tally
                        ? `${tally.present} present, ${tally.absent} absent, ${tally.late} late`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {canManage && register?.status === "submitted" ? (
                          <ReopenButton
                            registerId={register.id}
                            className={item.name as string}
                          />
                        ) : null}
                        <Link href={href} className={linkClass}>
                          {!canManage ? "View" : register ? "View / correct" : "Mark register"}
                        </Link>
                      </div>
                    </TableCell>
                  </ClickableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OverviewFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  return (
    <Suspense fallback={<OverviewFallback />}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  );
}
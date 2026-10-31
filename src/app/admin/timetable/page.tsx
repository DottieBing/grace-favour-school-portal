import { Suspense } from "react";
import Link from "next/link";

import { requireAreaAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClickableRow } from "@/components/admin/clickable-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const linkClass =
  "inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50";

async function TimetableContent() {
  await requireAreaAccess("timetable");

  const admin = createAdminClient();
  const session = await getCurrentSession();

  const [classesResult, schedulesResult, teachersResult, entriesResult] = await Promise.all([
    admin
      .from("classes")
      .select("id, name, timetable_schedule_id")
      .eq("is_active", true)
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin.from("timetable_schedules").select("id, name, is_default"),
    admin
      .from("staff")
      .select("id, full_name, staff_number")
      .eq("staff_type", "teaching")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    session
      ? admin
          .from("timetable_entries")
          .select("class_id")
          .eq("session_id", session.id)
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const failed =
    classesResult.error ?? schedulesResult.error ?? teachersResult.error ?? entriesResult.error;

  if (failed) {
    console.error("Unable to load the timetable overview:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the timetable. Please refresh the page.
        </div>
      </div>
    );
  }

  const schedules = schedulesResult.data ?? [];
  const defaultName = schedules.find((item) => item.is_default)?.name as string | undefined;
  const scheduleName = new Map(schedules.map((item) => [item.id as string, item.name as string]));

  const filled = new Map<string, number>();

  for (const row of entriesResult.data ?? []) {
    const id = row.class_id as string;
    filled.set(id, (filled.get(id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timetable</h1>
          <p className="text-sm text-slate-500">
            {session
              ? `Class timetables for the ${session.name} session.`
              : "Set a current term to start building timetables."}
          </p>
        </div>
        <Link href="/admin/timetable/periods" className={linkClass}>
          Periods &amp; schedules
        </Link>
      </div>

      {!defaultName ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No schedule exists yet. Create one on the Periods &amp; schedules page first,
          so there are periods to fill in.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Slots filled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(classesResult.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">
                  No active classes yet.
                </TableCell>
              </TableRow>
            ) : (
              (classesResult.data ?? []).map((item) => {
                const id = item.id as string;
                const own = item.timetable_schedule_id as string | null;

                return (
                  <ClickableRow key={id} href={`/admin/timetable/classes/${id}`}>
                    <TableCell className="font-medium text-slate-900">{item.name as string}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {own ? (scheduleName.get(own) ?? "-") : defaultName ? `${defaultName} (default)` : "-"}
                    </TableCell>
                    <TableCell>{filled.get(id) ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Link href={`/admin/timetable/classes/${id}`} className={linkClass}>
                          Open
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

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Teachers</h2>
          <p className="mt-1 text-sm text-slate-500">
            See each teacher&apos;s week across all their classes.
          </p>
        </div>
        {(teachersResult.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No active teachers yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(teachersResult.data ?? []).map((item) => (
              <Link key={item.id as string} href={`/admin/timetable/teachers/${item.id as string}`} className={linkClass}>
                {(item.full_name as string | null) ?? (item.staff_number as string)}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TimetableFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function TimetablePage() {
  return (
    <Suspense fallback={<TimetableFallback />}>
      <TimetableContent />
    </Suspense>
  );
}
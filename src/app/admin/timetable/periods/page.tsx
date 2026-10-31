import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/access";
import { getSchoolProfile } from "@/lib/settings/school";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtTime, DAY_SHORT } from "@/lib/timetable/time";
import type { PeriodInfo } from "@/lib/timetable/types";
import { ActionButton, DeleteButton } from "@/components/admin/action-buttons";
import { ClassScheduleSelect } from "@/components/timetable/class-schedule-select";
import { PeriodSheet } from "@/components/timetable/period-sheet";
import { ScheduleSheet } from "@/components/timetable/schedule-sheet";

async function PeriodsContent() {
  const { canManage } = await requireAreaAccess("timetable");

  const admin = createAdminClient();

  const [schedulesResult, periodsResult, classesResult, entriesResult, profile] =
    await Promise.all([
      admin
        .from("timetable_schedules")
        .select("id, name, is_default")
        .order("name", { ascending: true }),
      admin
        .from("timetable_periods")
        .select("id, schedule_id, name, start_time, end_time, is_break, days")
        .order("start_time", { ascending: true }),
      admin
        .from("classes")
        .select("id, name, timetable_schedule_id")
        .eq("is_active", true)
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      admin.from("timetable_entries").select("class_id").limit(5000),
      getSchoolProfile(),
    ]);

  const failed =
    schedulesResult.error ?? periodsResult.error ?? classesResult.error ?? entriesResult.error;

  if (failed) {
    console.error("Unable to load schedules:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the schedules. Please refresh the page.
        </div>
      </div>
    );
  }

  const schedules = schedulesResult.data ?? [];
  const withEntries = new Set((entriesResult.data ?? []).map((item) => item.class_id as string));

  const periodsBySchedule = new Map<string, (PeriodInfo & { raw: string })[]>();

  for (const row of periodsResult.data ?? []) {
    const list = periodsBySchedule.get(row.schedule_id as string) ?? [];

    list.push({
      raw: row.id as string,
      id: row.id as string,
      name: row.name as string,
      start: fmtTime(row.start_time as string),
      end: fmtTime(row.end_time as string),
      isBreak: row.is_break as boolean,
      days: (row.days as number[] | null) ?? null,
    });

    periodsBySchedule.set(row.schedule_id as string, list);
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/timetable"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to timetable
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Periods &amp; schedules</h1>
          <p className="text-sm text-slate-500">
            Define the school day once, or make several schedules if groups run different days.
          </p>
        </div>
        {canManage ? <ScheduleSheet /> : null}
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No schedules yet. Create one, for example &quot;Primary&quot;, then add its periods.
        </div>
      ) : (
        schedules.map((schedule) => {
          const id = schedule.id as string;
          const list = periodsBySchedule.get(id) ?? [];

          return (
            <section key={id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{schedule.name as string}</h2>
                  {schedule.is_default ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Default
                    </span>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <ScheduleSheet schedule={{ id, name: schedule.name as string }} />
                    {!schedule.is_default ? (
                      <>
                        <ActionButton
                          url={`/api/admin/timetable/schedules/${id}`}
                          body={{ isDefault: true }}
                          label="Make default"
                        />
                        <DeleteButton
                          url={`/api/admin/timetable/schedules/${id}`}
                          title={`Delete ${schedule.name as string}?`}
                          description="Its periods and every timetable slot built on them are removed. Classes using it fall back to the default schedule."
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {list.length === 0 ? (
                <p className="text-sm text-slate-500">No periods yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {list.map((period) => (
                    <li key={period.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="w-28 font-medium text-slate-900">{period.name}</span>
                        <span className="font-mono text-xs text-slate-600">
                          {period.start} to {period.end}
                        </span>
                        {period.isBreak ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Break</span>
                        ) : null}
                        <span className="text-xs text-slate-500">
                          {period.days ? period.days.map((day) => DAY_SHORT[day]).join(", ") : "All days"}
                        </span>
                      </div>

                      {canManage ? (
                        <div className="flex gap-2">
                          <PeriodSheet scheduleId={id} period={period} dayChoices={profile.timetableDays} />
                          <DeleteButton
                            url={`/api/admin/timetable/periods/${period.id}`}
                            title={`Delete ${period.name}?`}
                            description="Any lessons placed in this period, in every class using the schedule, are removed."
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {canManage ? <PeriodSheet scheduleId={id} dayChoices={profile.timetableDays} /> : null}
            </section>
          );
        })
      )}

      {schedules.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Which schedule each class uses</h2>
            <p className="mt-1 text-sm text-slate-500">
              Classes with no choice use the default schedule.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {(classesResult.data ?? []).map((item) => (
              <li key={item.id as string} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="text-sm font-medium text-slate-900">{item.name as string}</span>
                <ClassScheduleSelect
                  classId={item.id as string}
                  className={item.name as string}
                  value={(item.timetable_schedule_id as string | null) ?? ""}
                  schedules={schedules.map((entry) => ({ id: entry.id as string, name: entry.name as string }))}
                  hasEntries={withEntries.has(item.id as string)}
                  disabled={!canManage}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PeriodsFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function PeriodsPage() {
  return (
    <Suspense fallback={<PeriodsFallback />}>
      <PeriodsContent />
    </Suspense>
  );
}
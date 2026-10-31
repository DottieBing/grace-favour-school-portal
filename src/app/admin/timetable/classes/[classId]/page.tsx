import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getSchoolProfile } from "@/lib/settings/school";
import { loadClassSchedule } from "@/lib/timetable/schedule";
import { cellKey, type Cell } from "@/lib/timetable/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TimetableEditor,
  type OtherClassCells,
} from "@/components/timetable/timetable-editor";

type EntryRow = {
  class_id: string;
  period_id: string;
  day: number;
  subject_id: string | null;
  label: string | null;
  teacher_id: string | null;
  room: string | null;
};

function toCell(row: EntryRow): Cell {
  return {
    subjectId: row.subject_id,
    label: row.label ?? "",
    teacherId: row.teacher_id,
    room: row.room ?? "",
  };
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      {children}
    </div>
  );
}

async function ClassTimetableContent({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { canManage } = await requireAreaAccess("timetable");
  const { classId } = await params;

  if (!z.uuid().safeParse(classId).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [session, profile, schedule, classResult, allClasses, defaultResult] = await Promise.all([
    getCurrentSession(),
    getSchoolProfile(),
    loadClassSchedule(admin, classId),
    admin.from("classes").select("id, name, is_active").eq("id", classId).maybeSingle(),
    admin.from("classes").select("id, name, timetable_schedule_id").eq("is_active", true),
    admin.from("timetable_schedules").select("id").eq("is_default", true).maybeSingle(),
  ]);

  if (classResult.error || allClasses.error || defaultResult.error || !schedule) {
    console.error(
      "Unable to load the class timetable:",
      classResult.error?.message ?? allClasses.error?.message ?? defaultResult.error?.message,
    );

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this timetable. Please refresh the page.
        </div>
      </div>
    );
  }

  const cls = classResult.data;

  if (!cls) {
    notFound();
  }

  const header = (
    <>
      <Link
        href="/admin/timetable"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to timetable
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{cls.name as string}</h1>
        <p className="text-sm text-slate-500">
          {schedule.scheduleName
            ? `Schedule: ${schedule.scheduleName}${session ? ` · ${session.name} session` : ""}`
            : "No schedule yet"}
        </p>
      </div>
    </>
  );

  if (!session) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <Notice>Set a current term on the Academic Sessions page first.</Notice>
      </div>
    );
  }

  if (schedule.periods.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <Notice>
          This class has no periods yet. Add them on the{" "}
          <Link href="/admin/timetable/periods" className="font-medium text-[#0D5C63] hover:underline">
            Periods &amp; schedules
          </Link>{" "}
          page.
        </Notice>
      </div>
    );
  }

  const defaultId = (defaultResult.data?.id as string | undefined) ?? null;
  const sameClasses = (allClasses.data ?? []).filter(
    (item) =>
      item.id !== classId &&
      ((item.timetable_schedule_id as string | null) ?? defaultId) === schedule.scheduleId,
  );

  const [linksResult, assignmentsResult, teachersResult, entriesResult, othersResult] =
    await Promise.all([
      admin
        .from("class_subjects")
        .select("subjects(id, name, is_active)")
        .eq("class_id", classId)
        .eq("is_active", true),
      admin
        .from("teacher_assignments")
        .select("subject_id, teacher_id")
        .eq("class_id", classId)
        .eq("academic_session_id", session.id)
        .eq("is_active", true),
      admin
        .from("staff")
        .select("id, full_name, staff_number")
        .eq("staff_type", "teaching")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      admin
        .from("timetable_entries")
        .select("class_id, period_id, day, subject_id, label, teacher_id, room")
        .eq("session_id", session.id)
        .eq("class_id", classId),
      sameClasses.length > 0
        ? admin
            .from("timetable_entries")
            .select("class_id, period_id, day, subject_id, label, teacher_id, room")
            .eq("session_id", session.id)
            .in("class_id", sameClasses.map((item) => item.id as string))
        : Promise.resolve({ data: [], error: null }),
    ]);

  const failed =
    linksResult.error ??
    assignmentsResult.error ??
    teachersResult.error ??
    entriesResult.error ??
    othersResult.error;

  if (failed) {
    console.error("Unable to load timetable data:", failed.message);

    return (
      <div className="space-y-6 p-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this timetable. Please refresh the page.
        </div>
      </div>
    );
  }

  const assigned = new Map(
    (assignmentsResult.data ?? []).map((item) => [item.subject_id as string, item.teacher_id as string]),
  );

  type SubjectRaw = { subjects: { id: string; name: string; is_active: boolean } | { id: string; name: string; is_active: boolean }[] | null };

  const subjects = ((linksResult.data ?? []) as unknown as SubjectRaw[])
    .map((item) => (Array.isArray(item.subjects) ? item.subjects[0] : item.subjects))
    .filter((item): item is { id: string; name: string; is_active: boolean } => Boolean(item?.is_active))
    .map((item) => ({ id: item.id, name: item.name, teacherId: assigned.get(item.id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const teachers = (teachersResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: (item.full_name as string | null) ?? (item.staff_number as string),
  }));

  const initial: Record<string, Cell> = {};

  for (const row of (entriesResult.data ?? []) as EntryRow[]) {
    initial[cellKey(row.period_id, row.day)] = toCell(row);
  }

  const byClass = new Map<string, Record<string, Cell>>();

  for (const row of (othersResult.data ?? []) as EntryRow[]) {
    const entry = byClass.get(row.class_id) ?? {};
    entry[cellKey(row.period_id, row.day)] = toCell(row);
    byClass.set(row.class_id, entry);
  }

  const others: OtherClassCells[] = sameClasses
    .filter((item) => byClass.has(item.id as string))
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      cells: byClass.get(item.id as string) ?? {},
    }));

  return (
    <div className="space-y-6 p-6">
      {header}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {subjects.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            This class has no subjects yet. You can still use custom labels, or tick
            subjects on the class page.
          </p>
        ) : null}

        <TimetableEditor
          key={JSON.stringify(initial)}
          classId={classId}
          days={profile.timetableDays}
          periods={schedule.periods}
          subjects={subjects}
          teachers={teachers}
          initial={initial}
          others={others}
          readOnly={!canManage}
        />
      </section>
    </div>
  );
}

function ClassTimetableFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function ClassTimetablePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  return (
    <Suspense fallback={<ClassTimetableFallback />}>
      <ClassTimetableContent params={params} />
    </Suspense>
  );
}
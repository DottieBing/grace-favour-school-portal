import { Suspense, type ReactNode } from "react";
import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { StatusBadge } from "@/components/results/status-badge";
import type { SheetState } from "@/lib/results/types";

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Results</h1>
        <p className="text-sm text-slate-500">
          Enter scores for the subjects you teach.
        </p>
      </div>
      {children}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      {children}
    </div>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {children}
    </div>
  );
}

async function ResultsContent() {
  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();

  const [session, term] = await Promise.all([
    getCurrentSession(),
    getCurrentTerm(),
  ]);

  if (!session || !term) {
    return (
      <Page>
        <Notice>
          No current term has been set. Please contact the administrator.
        </Notice>
      </Page>
    );
  }

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Unable to load staff record:", staffError.message);
    return (
      <Page>
        <Problem>We couldn&apos;t load your account. Please refresh the page.</Problem>
      </Page>
    );
  }

  if (!staff) {
    return (
      <Page>
        <Notice>
          Your staff record wasn&apos;t found. Please contact the
          administrator.
        </Notice>
      </Page>
    );
  }

  const { data: assignments, error: assignmentError } = await admin
    .from("teacher_assignments")
    .select("class_id, subject_id")
    .eq("teacher_id", staff.id)
    .eq("academic_session_id", session.id)
    .eq("is_active", true);

  if (assignmentError) {
    console.error("Unable to load assignments:", assignmentError.message);
    return (
      <Page>
        <Problem>We couldn&apos;t load your subjects. Please refresh the page.</Problem>
      </Page>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Page>
        <Notice>
          You haven&apos;t been assigned any subjects yet. Please contact the
          administrator.
        </Notice>
      </Page>
    );
  }

  const classIds = [...new Set(assignments.map((item) => item.class_id as string))];
  const subjectIds = [
    ...new Set(assignments.map((item) => item.subject_id as string)),
  ];

  const [classesResult, subjectsResult, sheetsResult] = await Promise.all([
    admin
      .from("classes")
      .select("id, name")
      .in("id", classIds)
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin.from("subjects").select("id, name").in("id", subjectIds),
    admin
      .from("result_sheets")
      .select("class_id, subject_id, status")
      .eq("term_id", term.id)
      .in("class_id", classIds)
      .in("subject_id", subjectIds),
  ]);

  const failed =
    classesResult.error ?? subjectsResult.error ?? sheetsResult.error;

  if (failed) {
    console.error("Unable to load results overview:", failed.message);
    return (
      <Page>
        <Problem>We couldn&apos;t load your subjects. Please refresh the page.</Problem>
      </Page>
    );
  }

  const classOrder = new Map(
    (classesResult.data ?? []).map((item, index) => [item.id as string, index]),
  );
  const className = new Map(
    (classesResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );
  const subjectName = new Map(
    (subjectsResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );
  const stateByKey = new Map(
    (sheetsResult.data ?? []).map((item) => [
      `${item.class_id}:${item.subject_id}`,
      item.status as SheetState,
    ]),
  );

  const items = assignments
    .map((item) => {
      const classId = item.class_id as string;
      const subjectId = item.subject_id as string;

      return {
        classId,
        subjectId,
        className: className.get(classId) ?? "Class",
        subjectName: subjectName.get(subjectId) ?? "Subject",
        state: stateByKey.get(`${classId}:${subjectId}`) ?? ("not_started" as SheetState),
      };
    })
    .sort(
      (a, b) =>
        (classOrder.get(a.classId) ?? 0) - (classOrder.get(b.classId) ?? 0) ||
        a.subjectName.localeCompare(b.subjectName),
    );

  return (
    <Page>
      <p className="text-sm text-slate-600">
        {session.name} · {term.termName}
      </p>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={`${item.classId}:${item.subjectId}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-slate-900">{item.subjectName}</p>
              <p className="text-sm text-slate-500">{item.className}</p>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge state={item.state} />
              <Link
                href={`/teacher/results/${item.classId}/${item.subjectId}`}
                className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                {item.state === "not_started" || item.state === "draft"
                  ? "Enter scores"
                  : "View"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function ResultsFallback() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function TeacherResultsPage() {
  return (
    <Suspense fallback={<ResultsFallback />}>
      <ResultsContent />
    </Suspense>
  );
}
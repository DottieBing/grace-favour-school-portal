import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import {
  ResultsTable,
  type ResultRow,
} from "@/components/results/results-table";
import type { SheetState } from "@/lib/results/types";

async function ResultsContent() {
  await requireAreaAccess("results");

  const [session, term] = await Promise.all([
    getCurrentSession(),
    getCurrentTerm(),
  ]);

  if (!session || !term) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Results</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No current term is set. Set one on the Academic Sessions page first.
        </div>
      </div>
    );
  }

  const admin = createAdminClient();

  const [assignmentsResult, classesResult, subjectsResult, teachersResult, sheetsResult] =
    await Promise.all([
      admin
        .from("teacher_assignments")
        .select("id, class_id, subject_id, teacher_id")
        .eq("academic_session_id", session.id)
        .eq("is_active", true),
      admin
        .from("classes")
        .select("id, name")
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      admin.from("subjects").select("id, name"),
      admin
        .from("staff")
        .select("id, full_name, staff_number")
        .eq("staff_type", "teaching"),
      admin
        .from("result_sheets")
        .select("id, class_id, subject_id, status")
        .eq("term_id", term.id),
    ]);

  const failed =
    assignmentsResult.error ??
    classesResult.error ??
    subjectsResult.error ??
    teachersResult.error ??
    sheetsResult.error;

  if (failed) {
    console.error("Unable to load results:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the results. Please refresh the page.
        </div>
      </div>
    );
  }

  const classes = (classesResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
  }));
  const classOrder = new Map(classes.map((item, index) => [item.id, index]));
  const className = new Map(classes.map((item) => [item.id, item.name]));
  const subjectName = new Map(
    (subjectsResult.data ?? []).map((item) => [item.id as string, item.name as string]),
  );
  const teacherName = new Map(
    (teachersResult.data ?? []).map((item) => [
      item.id as string,
      (item.full_name as string | null) ?? (item.staff_number as string),
    ]),
  );
  const sheetByKey = new Map(
    (sheetsResult.data ?? []).map((item) => [
      `${item.class_id}:${item.subject_id}`,
      { id: item.id as string, status: item.status as SheetState },
    ]),
  );

  const rows: ResultRow[] = (assignmentsResult.data ?? [])
    .map((item) => {
      const classId = item.class_id as string;
      const subjectId = item.subject_id as string;
      const sheet = sheetByKey.get(`${classId}:${subjectId}`);

      return {
        key: item.id as string,
        sheetId: sheet?.id ?? null,
        classId,
        className: className.get(classId) ?? "Class",
        subjectName: subjectName.get(subjectId) ?? "Subject",
        teacherName: teacherName.get(item.teacher_id as string) ?? "Unknown teacher",
        state: sheet?.status ?? ("not_started" as SheetState),
      };
    })
    .sort(
      (a, b) =>
        (classOrder.get(a.classId) ?? 0) - (classOrder.get(b.classId) ?? 0) ||
        a.subjectName.localeCompare(b.subjectName),
    );

  const submitted = rows.filter((row) => row.state === "submitted").length;
  const published = rows.filter((row) => row.state === "published").length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Results</h1>
        <p className="text-sm text-slate-500">
          {session.name} · {term.termName}. {published} published, {submitted}{" "}
          waiting for review, {rows.length} subject sheets in total.
        </p>
      </div>

      <ResultsTable rows={rows} classes={classes} />
    </div>
  );
}

function ResultsFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function AdminResultsPage() {
  return (
    <Suspense fallback={<ResultsFallback />}>
      <ResultsContent />
    </Suspense>
  );
}
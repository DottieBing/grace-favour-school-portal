import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { loadSheet } from "@/lib/results/sheet-data";
import { ScoreGrid } from "@/components/results/score-grid";
import { StatusBadge } from "@/components/results/status-badge";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Link
        href="/teacher/results"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to results
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
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

async function SheetContent({
  params,
}: {
  params: Promise<{ classId: string; subjectId: string }>;
}) {
  const { user } = await requirePageAccess("teacher");
  const { classId, subjectId } = await params;

  if (
    !z.uuid().safeParse(classId).success ||
    !z.uuid().safeParse(subjectId).success
  ) {
    notFound();
  }

  const [session, term] = await Promise.all([
    getCurrentSession(),
    getCurrentTerm(),
  ]);

  if (!session || !term) {
    return (
      <Page title="Results">
        <Notice>
          No current term has been set. Please contact the administrator.
        </Notice>
      </Page>
    );
  }

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Unable to load staff record:", staffError.message);
    return (
      <Page title="Results">
        <Notice>We couldn&apos;t load your account. Please refresh the page.</Notice>
      </Page>
    );
  }

  if (!staff) {
    notFound();
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", staff.id)
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .eq("academic_session_id", session.id)
    .eq("is_active", true)
    .limit(1);

  if (assignmentError) {
    console.error("Unable to check assignment:", assignmentError.message);
    return (
      <Page title="Results">
        <Notice>We couldn&apos;t verify your subject. Please refresh the page.</Notice>
      </Page>
    );
  }

  // Not your subject: the page simply doesn't exist for you.
  if (!assignment || assignment.length === 0) {
    notFound();
  }

  const [classResult, subjectResult, data] = await Promise.all([
    admin.from("classes").select("name").eq("id", classId).maybeSingle(),
    admin.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
    loadSheet(admin, { classId, subjectId, termId: term.id }),
  ]);

  const title = `${classResult.data?.name ?? "Class"} · ${subjectResult.data?.name ?? "Subject"}`;

  if (classResult.error || subjectResult.error || !data) {
    return (
      <Page title={title}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the results sheet. Please refresh the page.
        </div>
      </Page>
    );
  }

  if (data.components.length === 0) {
    return (
      <Page title={title}>
        <Notice>
          No score components have been set up yet. Please contact the
          administrator.
        </Notice>
      </Page>
    );
  }

  if (data.students.length === 0) {
    return (
      <Page title={title}>
        <Notice>There are no active students in this class yet.</Notice>
      </Page>
    );
  }

  const locked = data.state === "submitted" || data.state === "published";

  return (
    <Page title={title}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          {session.name} · {term.termName}
        </p>
        <StatusBadge state={data.state} />
      </div>

      {data.state === "submitted" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Submitted and locked. Contact the administrator if something needs
          changing.
        </p>
      ) : null}

      {data.state === "published" ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          These results have been published.
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <ScoreGrid
          key={`${data.state}-${data.sheetId ?? "new"}`}
          classId={classId}
          subjectId={subjectId}
          students={data.students}
          components={data.components}
          initial={data.initial}
          grades={data.grades}
          readOnly={locked}
          confirmText="Submit these results? You won't be able to change them afterwards. The administrator can reopen them if something is wrong."
        />
      </section>
    </Page>
  );
}

function SheetFallback() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function TeacherSheetPage({
  params,
}: {
  params: Promise<{ classId: string; subjectId: string }>;
}) {
  return (
    <Suspense fallback={<SheetFallback />}>
      <SheetContent params={params} />
    </Suspense>
  );
}
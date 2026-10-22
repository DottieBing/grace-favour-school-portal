import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSheet } from "@/lib/results/sheet-data";
import {
  PublishButton,
  ReopenResultButton,
} from "@/components/results/result-actions";
import { ScoreGrid } from "@/components/results/score-grid";
import { StatusBadge } from "@/components/results/status-badge";

async function SheetContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAreaAccess("results");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const { data: sheet, error } = await admin
    .from("result_sheets")
    .select("id, class_id, subject_id, term_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the sheet:", error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this sheet. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!sheet) {
    notFound();
  }

  const classId = sheet.class_id as string;
  const subjectId = sheet.subject_id as string;

  const [classResult, subjectResult, termResult, data] = await Promise.all([
    admin.from("classes").select("name").eq("id", classId).maybeSingle(),
    admin.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
    admin
      .from("academic_terms")
      .select("name")
      .eq("id", sheet.term_id as string)
      .maybeSingle(),
    loadSheet(admin, {
      classId,
      subjectId,
      termId: sheet.term_id as string,
    }),
  ]);

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the scores. Please refresh the page.
        </div>
      </div>
    );
  }

  const title = `${classResult.data?.name ?? "Class"} · ${subjectResult.data?.name ?? "Subject"}`;

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/results"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to results
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <StatusBadge state={data.state} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {termResult.data?.name ?? "Term"}
          </p>
        </div>

        {data.state === "submitted" ? (
          <div className="flex gap-2">
            <ReopenResultButton sheetId={id} label={title} />
            <PublishButton sheetIds={[id]} label="Publish results" />
          </div>
        ) : null}
      </div>

      {data.state === "draft" ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          The teacher is still working on this sheet. It hasn&apos;t been
          submitted.
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        {data.components.length === 0 || data.students.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing to show yet.</p>
        ) : (
          <ScoreGrid
            classId={classId}
            subjectId={subjectId}
            students={data.students}
            components={data.components}
            initial={data.initial}
            grades={data.grades}
            readOnly
          />
        )}
      </section>
    </div>
  );
}

function SheetFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function AdminSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<SheetFallback />}>
      <SheetContent params={params} />
    </Suspense>
  );
}
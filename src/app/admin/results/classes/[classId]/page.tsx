import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { loadClassScoring } from "@/lib/results/class-scoring";
import { classSubjectIds } from "@/lib/results/scope";
import { gk, sk } from "@/lib/results/scoring-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublishButton, ReopenResultButton } from "@/components/results/result-actions";
import { StatusBadge } from "@/components/results/status-badge";

async function ClassResultsContent({ params }: { params: Promise<{ classId: string }> }) {
  const { canManage } = await requireAreaAccess("results");
  const { classId } = await params;

  if (!z.uuid().safeParse(classId).success) notFound();

  const admin = createAdminClient();
  const term = await getCurrentTerm();

  const [classResult, subjectIds] = await Promise.all([
    admin.from("classes").select("name").eq("id", classId).maybeSingle(),
    classSubjectIds(admin, classId),
  ]);

  if (classResult.error || !subjectIds) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this class. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!classResult.data) notFound();

  const back = (
    <Link
      href="/admin/results"
      className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft className="size-4" />
      Back to results
    </Link>
  );

  if (!term) {
    return (
      <div className="space-y-6 p-6">
        {back}
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No current term is set.
        </div>
      </div>
    );
  }

  const scoring = await loadClassScoring(admin, { classId, termId: term.id, subjectIds });

  if (!scoring) {
    return (
      <div className="space-y-6 p-6">
        {back}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the scores. Please refresh the page.
        </div>
      </div>
    );
  }

  const submitted = scoring.subjects.filter((item) => item.state === "submitted" && item.sheetId);

  return (
    <div className="space-y-6 p-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{classResult.data.name as string}</h1>
          <p className="text-sm text-slate-500">
            {term.sessionName} · {term.termName} · {scoring.students.length} students
          </p>
        </div>

        {canManage && submitted.length > 0 ? (
          <PublishButton
            sheetIds={submitted.map((item) => item.sheetId as string)}
            label={`Publish ${submitted.length} submitted subject${submitted.length === 1 ? "" : "s"}`}
          />
        ) : null}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Subjects</h2>
        {scoring.subjects.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">This class has no subjects yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {scoring.subjects.map((subject) => (
              <li key={subject.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900">{subject.name}</span>
                  <StatusBadge state={subject.state} />
                </div>
                <div className="flex gap-2">
                  {canManage && subject.state === "submitted" && subject.sheetId ? (
                    <ReopenResultButton sheetId={subject.sheetId} label={`${subject.name}`} />
                  ) : null}
                  {subject.sheetId ? (
                    <Link
                      href={`/admin/results/${subject.sheetId}`}
                      className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                    >
                      View sheet
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Students</h2>

        {scoring.students.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            There are no active students in this class.
          </div>
        ) : (
          scoring.students.map((student) => {
            const rows = scoring.subjects.map((subject) => {
              let total = 0;
              let max = 0;
              let filled = 0;

              const parts = subject.components.map((component) => {
                const value = scoring.scores[sk(student.id, subject.id, component.id)] ?? "";

                max += component.max;

                if (value !== "") {
                  total += Number(value);
                  filled += 1;
                }

                return `${component.name} ${value === "" ? "-" : value}`;
              });

              return {
                subject,
                parts,
                total,
                max,
                complete: filled === subject.components.length && subject.components.length > 0,
                grade: scoring.grades[gk(student.id, subject.id)],
              };
            });

            const done = rows.filter((row) => row.complete);
            const average =
              done.length === 0
                ? null
                : Math.round((done.reduce((sum, row) => sum + (row.total / row.max) * 100, 0) / done.length) * 10) /
                  10;

            return (
              <details key={student.id} className="group rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{student.name}</span>
                    <span className="font-mono text-xs text-slate-500">{student.admissionNumber}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {done.length}/{rows.length} subjects scored
                    {average !== null ? ` · average ${average}%` : ""}
                  </span>
                </summary>

                <div className="overflow-x-auto border-t border-slate-100 px-4 pb-4">
                  <table className="mt-3 w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500">
                        <th className="py-2 pr-3 font-medium">Subject</th>
                        <th className="py-2 pr-3 font-medium">Scores</th>
                        <th className="py-2 pr-3 font-medium">Total</th>
                        <th className="py-2 font-medium">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.subject.id} className="border-t border-slate-100">
                          <td className="py-2 pr-3 font-medium text-slate-900">{row.subject.name}</td>
                          <td className="py-2 pr-3 text-xs text-slate-600">{row.parts.join(" · ")}</td>
                          <td className="py-2 pr-3">{row.complete ? `${row.total}/${row.max}` : "-"}</td>
                          <td className="py-2 font-medium text-slate-900">{row.grade?.grade ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })
        )}
      </section>
    </div>
  );
}

export default function ClassResultsPage({ params }: { params: Promise<{ classId: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <ClassResultsContent params={params} />
    </Suspense>
  );
}
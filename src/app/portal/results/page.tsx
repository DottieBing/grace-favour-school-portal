import { Suspense } from "react";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/portal/student";
import { loadStudentResults } from "@/lib/results/student-results";

async function ResultsContent() {
  const student = await requireStudent();
  const terms = await loadStudentResults(createAdminClient(), student.id);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Results</h1>
        <p className="text-sm text-slate-500">
          Report cards appear here once the school publishes them.
        </p>
      </div>

      {!terms ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the results. Please refresh the page.
        </div>
      ) : terms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">No published results yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {[...terms].reverse().map((term) => (
            <li
              key={term.termId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {term.termName}, {term.sessionName}
                </p>
                <p className="text-sm text-slate-500">
                  {term.className} · {term.subjects.length} subject
                  {term.subjects.length === 1 ? "" : "s"} · average {term.average}%
                </p>
              </div>
              <Link
                href={`/portal/results/${term.termId}`}
                className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Report card
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PortalResultsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <ResultsContent />
    </Suspense>
  );
}
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Trophy } from "lucide-react";

import { requireStudent } from "@/lib/portal/student";
import { ordinal } from "@/lib/results/ordinal";
import { loadStudentResults } from "@/lib/results/student-results";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgressRing } from "@/components/kit/progress-ring";

async function ResultsContent() {
  await connection();

  const student = await requireStudent();
  const terms = await loadStudentResults(createAdminClient(), student.id);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="anim-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Results</h1>
        <p className="text-sm text-slate-500">Report cards appear here once the school publishes them.</p>
      </div>

      {!terms ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the results. Please refresh the page.
        </div>
      ) : terms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">No published results yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...terms].reverse().map((term, index) => (
            <Link
              key={term.termId}
              href={`/portal/results/${term.termId}`}
              className="anim-fade-up group flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <ProgressRing value={Math.min(term.average, 100) / 100} size={72}>
                <span className="text-sm font-semibold">{term.average}%</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{term.termName}</p>
                <p className="text-sm text-slate-500">
                  {term.sessionName} · {term.className}
                </p>
                {term.position ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#8A6D1F]">
                    <Trophy size={12} />
                    {ordinal(term.position)} of {term.outOf}
                  </p>
                ) : null}
              </div>
              <ArrowRight className="size-5 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalResultsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-[#E3EAE6]" />}>
      <ResultsContent />
    </Suspense>
  );
}
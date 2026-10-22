import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadStudentResults } from "@/lib/results/student-results";

export async function StudentAcademicsSection({
  studentId,
}: {
  studentId: string;
}) {
  const admin = createAdminClient();
  const terms = await loadStudentResults(admin, studentId);

  if (!terms) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        We couldn&apos;t load the results. Please refresh the page.
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-900">No published results yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Scores, term trends and report cards appear here once results are
          published.
        </p>
      </div>
    );
  }

  const latest = terms[terms.length - 1];
  const ranked = [...latest.subjects].sort((a, b) => b.percent - a.percent);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Latest average</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {latest.average}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {latest.termName}, {latest.sessionName}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Class position</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {latest.position ? `${latest.position} of ${latest.outOf}` : "-"}
          </div>
          <div className="mt-1 text-xs text-slate-400">{latest.className}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Strongest subject</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {strongest.subject}
          </div>
          <div className="mt-1 text-xs text-slate-400">{strongest.percent}%</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Needs attention</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {ranked.length > 1 ? weakest.subject : "-"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {ranked.length > 1 ? `${weakest.percent}%` : "Needs two or more subjects"}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Average by term</h2>
        <div className="mt-4 space-y-4">
          {terms.map((term) => (
            <div key={term.termId}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {term.termName}, {term.sessionName}
                </span>
                <span className="text-slate-500">{term.average}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0D5C63]"
                  style={{ width: `${Math.min(term.average, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {[...terms].reverse().map((term) => (
        <section
          key={term.termId}
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {term.termName}, {term.sessionName}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {term.className} · average {term.average}%
                {term.position ? ` · position ${term.position} of ${term.outOf}` : ""}
              </p>
            </div>
            <Link
              href={`/admin/students/${studentId}/report/${term.termId}`}
              className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Report card
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">%</th>
                  <th className="py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {term.subjects.map((item) => (
                  <tr key={item.subject} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{item.subject}</div>
                      <div className="text-xs text-slate-500">
                        {item.breakdown
                          .map((part) => `${part.name} ${part.score}/${part.max}`)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {item.total}/{item.max}
                    </td>
                    <td className="py-2 pr-3">{item.percent}%</td>
                    <td className="py-2 font-medium text-slate-900">{item.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
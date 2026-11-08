import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { loadClassScoring } from "@/lib/results/class-scoring";
import { loadTeacherScopes } from "@/lib/results/scope";
import { completion } from "@/lib/results/scoring-types";
import { loadTeacherProfile } from "@/lib/teacher/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgressRing } from "@/components/kit/progress-ring";

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="anim-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Results</h1>
        <p className="text-sm text-slate-500">Score your students, one at a time.</p>
      </div>
      {children}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600">{children}</div>
  );
}

async function ResultsHome() {
  await connection();

  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();

  const [session, term, profile] = await Promise.all([
    getCurrentSession(),
    getCurrentTerm(),
    loadTeacherProfile(admin, user.id),
  ]);

  if (!session || !term) {
    return <Page><Notice>No current term has been set. Please contact the administrator.</Notice></Page>;
  }

  if (!profile) {
    return <Page><Notice>Your staff record wasn&apos;t found. Please contact the administrator.</Notice></Page>;
  }

  const scopes = await loadTeacherScopes(admin, profile.staffId, session.id);

  if (!scopes) {
    return <Page><Notice>We couldn&apos;t load your classes. Please refresh the page.</Notice></Page>;
  }

  if (scopes.length === 0) {
    return <Page><Notice>You haven&apos;t been assigned to a class yet. Please contact the administrator.</Notice></Page>;
  }

  const cards = await Promise.all(
    scopes.map(async (scope) => {
      const scoring = await loadClassScoring(admin, {
        classId: scope.classId,
        termId: term.id,
        subjectIds: scope.subjectIds,
      });

      return { scope, scoring, stats: scoring ? completion(scoring) : null };
    }),
  );

  return (
    <Page>
      <p className="text-sm text-slate-600">
        {term.sessionName} · {term.termName}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ scope, scoring, stats }, index) => {
          const submitted = scoring ? scoring.subjects.filter((item) => item.locked).length : 0;

          return (
            <Link
              key={scope.classId}
              href={`/teacher/results/score/${scope.classId}`}
              className="anim-fade-up group flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <ProgressRing
                value={stats && stats.totalCells > 0 ? stats.filledCells / stats.totalCells : 0}
                size={72}
              >
                <span className="text-sm font-semibold">
                  {stats && stats.totalCells > 0 ? Math.round((stats.filledCells / stats.totalCells) * 100) : 0}%
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">{scope.className}</p>
                <p className="text-sm text-slate-500">
                  {scope.isClassTeacher ? "Class teacher · all subjects" : "Your subjects"} ·{" "}
                  {scope.subjectIds.length} subject{scope.subjectIds.length === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-slate-500">
                  {stats
                    ? `${stats.completeStudents}/${stats.totalStudents} students done · ${submitted} subject${submitted === 1 ? "" : "s"} submitted`
                    : "Couldn't load progress"}
                </p>
              </div>
              <ArrowRight className="size-5 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

export default function TeacherResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 p-4 sm:p-6">
          <div className="h-8 w-40 animate-pulse rounded bg-[#E3EAE6]" />
          <div className="h-32 animate-pulse rounded-3xl bg-[#E3EAE6]" />
        </div>
      }
    >
      <ResultsHome />
    </Suspense>
  );
}
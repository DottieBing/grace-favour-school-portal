import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requirePageAccess } from "@/lib/auth/access";
import { loadClassScoring } from "@/lib/results/class-scoring";
import { getTeacherScope } from "@/lib/results/scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentScoring } from "@/components/results/student-scoring";

async function ScoreContent({ params }: { params: Promise<{ classId: string }> }) {
  await connection();

  const { user } = await requirePageAccess("teacher");
  const { classId } = await params;

  if (!z.uuid().safeParse(classId).success) notFound();

  const admin = createAdminClient();
  const found = await getTeacherScope(admin, user.id, classId);

  if (!found.ok) {
    if (found.status === 403) notFound();

    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600">
          {found.message}
        </div>
      </div>
    );
  }

  const scoring = await loadClassScoring(admin, {
    classId,
    termId: found.termId,
    subjectIds: found.scope.subjectIds,
  });

  const header = (
    <>
      <Link
        href="/teacher/results"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to results
      </Link>
      <div className="anim-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{found.scope.className}</h1>
        <p className="text-sm text-slate-500">{found.termLabel}</p>
      </div>
    </>
  );

  if (!scoring) {
    return (
      <div className="space-y-5 p-4 sm:p-6">
        {header}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the scores. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {header}

      {scoring.subjects.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600">
          There are no subjects for you to score in this class yet.
        </div>
      ) : scoring.subjects[0].components.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600">
          No score components are set up yet. Please contact the administrator.
        </div>
      ) : (
        <StudentScoring
          key={scoring.subjects.map((item) => `${item.id}:${item.state}`).join(",")}
          classId={classId}
          students={scoring.students}
          subjects={scoring.subjects}
          initial={scoring.scores}
        />
      )}
    </div>
  );
}

export default function ScorePage({ params }: { params: Promise<{ classId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 p-4 sm:p-6">
          <div className="h-8 w-40 animate-pulse rounded bg-[#E3EAE6]" />
          <div className="h-64 animate-pulse rounded-3xl bg-[#E3EAE6]" />
        </div>
      }
    >
      <ScoreContent params={params} />
    </Suspense>
  );
}
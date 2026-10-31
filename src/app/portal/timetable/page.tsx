import { Suspense } from "react";

import { getCurrentSession } from "@/lib/academic/current-session";
import { requireStudent } from "@/lib/portal/student";
import { getSchoolProfile } from "@/lib/settings/school";
import { loadClassAgenda } from "@/lib/timetable/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgendaView } from "@/components/timetable/agenda-view";

async function TimetableContent() {
  const student = await requireStudent();
  const [session, profile] = await Promise.all([getCurrentSession(), getSchoolProfile()]);

  let body: React.ReactNode;

  if (!session || !student.classId) {
    body = (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        The timetable isn&apos;t available yet.
      </div>
    );
  } else {
    const items = await loadClassAgenda(
      createAdminClient(),
      student.classId,
      session.id,
      profile.timetableDays,
    );

    body =
      items === null ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the timetable. Please refresh the page.
        </div>
      ) : (
        <AgendaView
          days={profile.timetableDays}
          items={items}
          emptyText="The class timetable hasn't been set up yet."
        />
      );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Timetable</h1>
        <p className="text-sm text-slate-500">
          {student.className ?? "Your class"}
          {session ? ` · ${session.name} session` : ""}
        </p>
      </div>
      {body}
    </div>
  );
}

export default function PortalTimetablePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <TimetableContent />
    </Suspense>
  );
}
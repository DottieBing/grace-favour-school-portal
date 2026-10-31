import { Suspense } from "react";

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getSchoolProfile } from "@/lib/settings/school";
import { loadTeacherAgenda } from "@/lib/timetable/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgendaView } from "@/components/timetable/agenda-view";

async function TimetableContent() {
  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();

  const [session, profile, staffResult] = await Promise.all([
    getCurrentSession(),
    getSchoolProfile(),
    admin.from("staff").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  let body: React.ReactNode;

  if (!session) {
    body = (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No current term has been set. Please contact the administrator.
      </div>
    );
  } else if (staffResult.error || !staffResult.data) {
    body = (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Your staff record wasn&apos;t found. Please contact the administrator.
      </div>
    );
  } else {
    const items = await loadTeacherAgenda(admin, staffResult.data.id as string, session.id);

    body =
      items === null ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load your timetable. Please refresh the page.
        </div>
      ) : (
        <AgendaView
          days={profile.timetableDays}
          items={items}
          emptyText="Your timetable hasn't been set up yet."
        />
      );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My timetable</h1>
        <p className="text-sm text-slate-500">Your lessons across all your classes.</p>
      </div>
      {body}
    </div>
  );
}

export default function TeacherTimetablePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <TimetableContent />
    </Suspense>
  );
}
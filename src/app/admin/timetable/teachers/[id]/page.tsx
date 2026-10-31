import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getSchoolProfile } from "@/lib/settings/school";
import { loadTeacherAgenda } from "@/lib/timetable/agenda";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgendaView } from "@/components/timetable/agenda-view";

async function TeacherWeekContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAreaAccess("timetable");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [session, profile, staffResult] = await Promise.all([
    getCurrentSession(),
    getSchoolProfile(),
    admin.from("staff").select("full_name, staff_number, staff_type").eq("id", id).maybeSingle(),
  ]);

  if (staffResult.error) {
    console.error("Unable to load the teacher:", staffResult.error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this page. Please refresh.
        </div>
      </div>
    );
  }

  if (!staffResult.data || staffResult.data.staff_type !== "teaching") {
    notFound();
  }

  const items = session ? await loadTeacherAgenda(admin, id, session.id) : [];

  const name =
    (staffResult.data.full_name as string | null) ?? (staffResult.data.staff_number as string);

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/timetable"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to timetable
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
        <p className="text-sm text-slate-500">
          Weekly timetable{session ? ` · ${session.name} session` : ""}
        </p>
      </div>

      {items === null ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the timetable. Please refresh the page.
        </div>
      ) : (
        <AgendaView
          days={profile.timetableDays}
          items={items}
          emptyText="This teacher has no lessons in any timetable yet."
        />
      )}
    </div>
  );
}

export default function TeacherWeekPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <TeacherWeekContent params={params} />
    </Suspense>
  );
}
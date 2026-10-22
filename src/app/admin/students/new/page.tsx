import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import {
  RegisterStudentForm,
  type ClassOption,
} from "@/components/students/register-student-form";

async function NewStudentContent() {
  await requireAreaAccess("students", "manage");

  const admin = createAdminClient();

  const [classesResult, studentsResult, sessionsResult, session] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name, capacity")
        .eq("is_active", true)
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      admin
        .from("students")
        .select("current_class_id")
        .eq("status", "active")
        .not("current_class_id", "is", null),
      admin
        .from("academic_sessions")
        .select("name")
        .order("name", { ascending: false }),
      getCurrentSession(),
    ]);

  const firstError =
    classesResult.error ?? studentsResult.error ?? sessionsResult.error;

  if (firstError) {
    console.error("Unable to load registration data:", firstError.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the form. Please refresh the page.
        </div>
      </div>
    );
  }

  const counts = new Map<string, number>();

  for (const row of studentsResult.data ?? []) {
    const classId = row.current_class_id as string;
    counts.set(classId, (counts.get(classId) ?? 0) + 1);
  }

  const classes: ClassOption[] = (classesResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    count: counts.get(item.id as string) ?? 0,
    capacity: (item.capacity as number | null) ?? null,
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Add student</h1>
        <p className="text-sm text-slate-500">
          Registering a student creates their login and links their guardian.
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          There are no active classes yet. Add classes first.
        </div>
      ) : (
        <RegisterStudentForm
          classes={classes}
          sessionNames={(sessionsResult.data ?? []).map(
            (item) => item.name as string,
          )}
          defaultSession={session?.name ?? ""}
        />
      )}
    </div>
  );
}

function NewStudentFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-96 max-w-2xl animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function NewStudentPage() {
  return (
    <Suspense fallback={<NewStudentFallback />}>
      <NewStudentContent />
    </Suspense>
  );
}
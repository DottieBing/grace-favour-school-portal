import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { levelLabel } from "@/lib/academic/levels";
import {
  ClassSubjectsForm,
  type OtherClass,
  type SubjectOption,
} from "@/components/classes/class-subjects-form";
import {
  ClassTeachers,
  type AssignmentItem,
  type SubjectChoice,
  type TeacherOption,
} from "@/components/classes/class-teachers";

async function ClassContent({ params }: { params: Promise<{ id: string }> }) {
  const { canManage } = await requireAreaAccess("classes");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [
    classResult,
    subjectsResult,
    linksResult,
    classesResult,
    studentsResult,
    teachersResult,
    session,
  ] = await Promise.all([
    admin
      .from("classes")
      .select("id, name, level_number, capacity, is_active")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("subjects")
      .select("id, name, code, is_active")
      .order("name", { ascending: true }),
    admin
      .from("class_subjects")
      .select("class_id, subject_id")
      .eq("is_active", true),
    admin
      .from("classes")
      .select("id, name")
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("current_class_id", id)
      .eq("status", "active"),
    admin
      .from("staff")
      .select("id, full_name, staff_number, is_active")
      .eq("staff_type", "teaching")
      .order("full_name", { ascending: true }),
    getCurrentSession(),
  ]);

  const assignmentsResult = session
    ? await admin
        .from("teacher_assignments")
        .select("id, teacher_id, subject_id, is_class_teacher")
        .eq("class_id", id)
        .eq("academic_session_id", session.id)
        .eq("is_active", true)
    : null;

  const firstError =
    classResult.error ??
    subjectsResult.error ??
    linksResult.error ??
    classesResult.error ??
    teachersResult.error ??
    assignmentsResult?.error;

  if (firstError) {
    console.error("Unable to load class page:", firstError.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this class. Please refresh the page.
        </div>
      </div>
    );
  }

  const cls = classResult.data;

  if (!cls) {
    notFound();
  }

  const subjectsByClass = new Map<string, string[]>();

  for (const link of linksResult.data ?? []) {
    const classId = link.class_id as string;
    const list = subjectsByClass.get(classId) ?? [];
    list.push(link.subject_id as string);
    subjectsByClass.set(classId, list);
  }

  const subjects: SubjectOption[] = (subjectsResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    code: (item.code as string | null) ?? null,
    isActive: item.is_active as boolean,
  }));

  const otherClasses: OtherClass[] = (classesResult.data ?? [])
    .filter((item) => item.id !== id)
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      subjectIds: subjectsByClass.get(item.id as string) ?? [],
    }));

  const students = studentsResult.count ?? 0;

  // Teachers section data.
  const teacherById = new Map(
    (teachersResult.data ?? []).map((item) => [
      item.id as string,
      {
        name: (item.full_name as string | null) ?? (item.staff_number as string),
        staffNumber: item.staff_number as string,
        isActive: item.is_active as boolean,
      },
    ]),
  );

  const subjectNameById = new Map(subjects.map((item) => [item.id, item.name]));

  const assignments: AssignmentItem[] = (assignmentsResult?.data ?? [])
    .map((row) => {
      const teacher = teacherById.get(row.teacher_id as string);

      return {
        id: row.id as string,
        teacherId: row.teacher_id as string,
        teacherName: teacher?.name ?? "Unknown teacher",
        teacherActive: teacher?.isActive ?? false,
        subjectName: subjectNameById.get(row.subject_id as string) ?? "Subject",
        isClassTeacher: row.is_class_teacher as boolean,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const assignedSubjectIds = new Set(
    (assignmentsResult?.data ?? []).map((row) => row.subject_id as string),
  );

  const subjectChoices: SubjectChoice[] = subjects
    .filter(
      (item) =>
        item.isActive &&
        (subjectsByClass.get(id) ?? []).includes(item.id) &&
        !assignedSubjectIds.has(item.id),
    )
    .map((item) => ({ id: item.id, name: item.name }));

  const teacherOptions: TeacherOption[] = [...teacherById.entries()]
    .filter(([, teacher]) => teacher.isActive)
    .map(([teacherId, teacher]) => ({
      id: teacherId,
      name: teacher.name,
      staffNumber: teacher.staffNumber,
    }));

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to classes
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">{cls.name}</h1>
          <span
            className={
              cls.is_active
                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
            }
          >
            {cls.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {levelLabel(cls.level_number as number)} · {students} active student
          {students === 1 ? "" : "s"}
          {cls.capacity ? ` of ${cls.capacity}` : ""}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Subjects taken by this class
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Teachers can only be assigned to subjects ticked here.
        </p>

                <fieldset disabled={!canManage} className="m-0 min-w-0 border-0 p-0">
        <ClassSubjectsForm
          key={[...(subjectsByClass.get(id) ?? [])].sort().join(",")}
          classId={id}
          subjects={subjects}
          selected={subjectsByClass.get(id) ?? []}
          otherClasses={otherClasses}
        />
        </fieldset>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Teachers</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          {session
            ? `Assignments for the ${session.name} session.`
            : "Assignments belong to the current session."}
        </p>

        {!session ? (
          <p className="text-sm text-slate-600">
            No current term is set. Set one on the Academic Sessions page before
            assigning teachers.
          </p>
        ) : (
        <fieldset disabled={!canManage} className="m-0 min-w-0 border-0 p-0">
          <ClassTeachers
            key={assignments
              .map((item) => `${item.id}:${item.isClassTeacher}`)
              .join(",")}
            classId={id}
            assignments={assignments}
            teachers={teacherOptions}
            subjectChoices={subjectChoices}
          />
          </fieldset>
        )}
      </section>
    </div>
  );
}

function ClassFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ClassFallback />}>
      <ClassContent params={params} />
    </Suspense>
  );
}
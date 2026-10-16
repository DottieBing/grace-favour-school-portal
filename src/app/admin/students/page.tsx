import { Suspense } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  StudentsTable,
  type StudentRow,
} from "@/components/students/students-table";

type Raw = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  current_class_id: string | null;
  status: StudentRow["status"];
  classes: { name: string } | { name: string }[] | null;
  student_guardians:
    | {
        is_primary: boolean;
        guardians: { phone: string | null } | { phone: string | null }[] | null;
      }[]
    | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function StudentsContent() {
  await requirePageAccess("super_admin");

  const admin = createAdminClient();

  const [studentsResult, classesResult] = await Promise.all([
    admin
      .from("students")
      .select(
        "id, admission_number, first_name, middle_name, last_name, current_class_id, status, classes(name), student_guardians(is_primary, guardians(phone))",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("classes")
      .select("id, name")
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
  ]);

  const failed = studentsResult.error ?? classesResult.error;

  if (failed) {
    console.error("Unable to load students:", failed.message);
  }

  const rows: StudentRow[] = ((studentsResult.data ?? []) as unknown as Raw[]).map(
    (item) => {
      const links = item.student_guardians ?? [];
      const primary = links.find((link) => link.is_primary) ?? links[0];

      return {
        id: item.id,
        admissionNumber: item.admission_number,
        name: [item.first_name, item.middle_name, item.last_name]
          .filter(Boolean)
          .join(" "),
        classId: item.current_class_id,
        className: first(item.classes)?.name ?? null,
        guardianPhone: primary ? (first(primary.guardians)?.phone ?? null) : null,
        status: item.status,
      };
    },
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">
            {rows.length} student{rows.length === 1 ? "" : "s"} on record.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/students/import"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <Upload className="size-4" />
            Import students
          </Link>
          <Link
            href="/admin/students/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0D5C63] px-4 text-sm font-medium text-white hover:bg-[#09494F]"
          >
            <Plus className="size-4" />
            Add student
          </Link>
        </div>
      </div>

      {failed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the students. Please refresh the page.
        </div>
      ) : (
        <StudentsTable
          students={rows}
          classes={(classesResult.data ?? []).map((item) => ({
            id: item.id as string,
            name: item.name as string,
          }))}
        />
      )}
    </div>
  );
}

function StudentsFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<StudentsFallback />}>
      <StudentsContent />
    </Suspense>
  );
}
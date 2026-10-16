import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImportStudents } from "@/components/students/import-students";

async function ImportContent() {
  await requirePageAccess("super_admin");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("classes")
    .select("name")
    .eq("is_active", true)
    .order("level_number", { ascending: true })
    .order("section", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("Unable to load classes:", error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the page. Please refresh.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to students
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import students</h1>
        <p className="text-sm text-slate-500">
          Add many existing students at once from an Excel or CSV file.
        </p>
      </div>

      <ImportStudents classNames={(data ?? []).map((item) => item.name as string)} />
    </div>
  );
}

function ImportFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-64 max-w-2xl animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<ImportFallback />}>
      <ImportContent />
    </Suspense>
  );
}
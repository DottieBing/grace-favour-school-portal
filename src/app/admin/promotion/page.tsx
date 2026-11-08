import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LEVELS } from "@/lib/academic/levels";
import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const FINAL_LEVEL = LEVELS[LEVELS.length - 1].number;

async function PromotionContent() {
  await requireAreaAccess("students", "manage");

  const admin = createAdminClient();

  const [classesResult, studentsResult] = await Promise.all([
    admin
      .from("classes")
      .select("id, name, level_number")
      .eq("is_active", true)
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin
      .from("students")
      .select("current_class_id")
      .eq("status", "active")
      .not("current_class_id", "is", null)
      .limit(2000),
  ]);

  if (classesResult.error || studentsResult.error) {
    console.error("Unable to load promotion:", classesResult.error?.message ?? studentsResult.error?.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this page. Please refresh.
        </div>
      </div>
    );
  }

  const counts = new Map<string, number>();

  for (const row of studentsResult.data ?? []) {
    const id = row.current_class_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Promotion</h1>
        <p className="text-sm text-slate-500">
          At the end of a session, choose who moves up. Do the top class first, so the next class has room.
          Generate fees and reassign teachers for the new session afterwards.
        </p>
      </div>

      {(classesResult.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          There are no active classes yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...(classesResult.data ?? [])].reverse().map((item) => {
            const id = item.id as string;
            const count = counts.get(id) ?? 0;

            return (
              <Link
                key={id}
                href={`/admin/promotion/${id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.name as string}</p>
                  <p className="text-sm text-slate-500">
                    {count} student{count === 1 ? "" : "s"} ·{" "}
                    {item.level_number === FINAL_LEVEL ? "graduates" : "moves up one level"}
                  </p>
                </div>
                <ArrowRight className="size-5 text-slate-400 transition group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PromotionPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <PromotionContent />
    </Suspense>
  );
}
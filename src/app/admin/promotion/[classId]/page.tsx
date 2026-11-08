import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { LEVELS } from "@/lib/academic/levels";
import { requireAreaAccess } from "@/lib/auth/access";
import { loadClassStanding } from "@/lib/promotion/standing";
import { createAdminClient } from "@/lib/supabase/admin";
import { PromotionBoard, type PromotionRow } from "@/components/promotion/promotion-board";

const FINAL_LEVEL = LEVELS[LEVELS.length - 1].number;

async function ClassPromotionContent({ params }: { params: Promise<{ classId: string }> }) {
  await requireAreaAccess("students", "manage");
  const { classId } = await params;

  if (!z.uuid().safeParse(classId).success) notFound();

  const admin = createAdminClient();

  const classResult = await admin
    .from("classes")
    .select("id, name, level_number")
    .eq("id", classId)
    .maybeSingle();

  if (classResult.error) {
    console.error("Unable to load the class:", classResult.error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this class. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!classResult.data) notFound();

  const level = classResult.data.level_number as number;
  const isFinal = level === FINAL_LEVEL;

  const [studentsResult, destinationsResult, standing] = await Promise.all([
    admin
      .from("students")
      .select("id, admission_number, first_name, middle_name, last_name")
      .eq("current_class_id", classId)
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(1000),
    isFinal
      ? Promise.resolve({ data: [], error: null })
      : admin
          .from("classes")
          .select("id, name")
          .eq("is_active", true)
          .eq("level_number", level + 1)
          .order("section", { ascending: true, nullsFirst: true }),
    loadClassStanding(admin, classId),
  ]);

  if (studentsResult.error || destinationsResult.error || !standing) {
    console.error(
      "Unable to load promotion data:",
      studentsResult.error?.message ?? destinationsResult.error?.message ?? "standing",
    );

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this page. Please refresh.
        </div>
      </div>
    );
  }

  const students: PromotionRow[] = (studentsResult.data ?? []).map((row) => {
    const id = row.id as string;
    const result = standing.byStudent.get(id);

    return {
      id,
      name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
      admissionNumber: row.admission_number as string,
      average: result?.average ?? null,
      position: result?.position ?? null,
    };
  });

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/promotion"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to promotion
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{classResult.data.name as string}</h1>
        <p className="text-sm text-slate-500">
          {students.length} active student{students.length === 1 ? "" : "s"}
        </p>
      </div>

      <PromotionBoard
        classId={classId}
        className={classResult.data.name as string}
        students={students}
        destinations={(destinationsResult.data ?? []).map((item) => ({
          id: item.id as string,
          name: item.name as string,
        }))}
        isFinal={isFinal}
        standingLabel={standing.label}
        outOf={standing.outOf}
      />
    </div>
  );
}

export default function ClassPromotionPage({ params }: { params: Promise<{ classId: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <ClassPromotionContent params={params} />
    </Suspense>
  );
}
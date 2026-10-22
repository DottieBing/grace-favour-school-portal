import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmStatusButton } from "@/components/admin/confirm-status-button";
import { ComponentSheet } from "@/components/grading/component-sheet";
import { BandsEditor, type BandData } from "@/components/grading/bands-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ComponentRow = {
  id: string;
  name: string;
  max_score: number;
  is_active: boolean;
};

async function GradingContent() {
  await requireAreaAccess("grading");

  const admin = createAdminClient();

  const [componentsResult, bandsResult] = await Promise.all([
    admin
      .from("assessment_components")
      .select("id, name, max_score, is_active")
      .order("sort_order", { ascending: true }),
    admin
      .from("grade_bands")
      .select("grade, min_percent, remark, points")
      .order("min_percent", { ascending: false }),
  ]);

  const failed = componentsResult.error ?? bandsResult.error;

  if (failed) {
    console.error("Unable to load grading settings:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the grading settings. Please refresh the page.
        </div>
      </div>
    );
  }

  const components = (componentsResult.data ?? []) as ComponentRow[];
  const activeTotal = components
    .filter((item) => item.is_active)
    .reduce((sum, item) => sum + Number(item.max_score), 0);

  const bands: BandData[] = (bandsResult.data ?? []).map((item) => ({
    grade: item.grade as string,
    minPercent: Number(item.min_percent),
    remark: (item.remark as string | null) ?? "",
    points: item.points === null ? null : Number(item.points),
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Grading</h1>
        <p className="text-sm text-slate-500">
          How scores are made up and how percentages turn into grades. You can
          change these anytime. Published results keep the grades they were
          published with.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Score components
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The parts of a subject score. Active components add up to{" "}
              <span className="font-medium text-slate-900">{activeTotal}</span>{" "}
              marks, and the percentage is worked out from that total.
            </p>
          </div>
          <ComponentSheet />
        </div>

        <div className="rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Maximum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    No components yet. For example: &quot;CA&quot; with a
                    maximum of 40 and &quot;Exam&quot; with a maximum of 60.
                  </TableCell>
                </TableRow>
              ) : (
                components.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.is_active ? "" : "opacity-60"}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {item.name}
                    </TableCell>
                    <TableCell>{Number(item.max_score)}</TableCell>
                    <TableCell>
                      <span
                        className={
                          item.is_active
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        }
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <ComponentSheet
                          component={{
                            id: item.id,
                            name: item.name,
                            maxScore: Number(item.max_score),
                          }}
                        />
                        <ConfirmStatusButton
                          url={`/api/admin/grading/components/${item.id}`}
                          name={item.name}
                          isActive={item.is_active}
                          deactivateMessage="It will no longer count toward new results. Scores already entered keep it. You can reactivate it anytime."
                          reactivateMessage="It will count toward new results again."
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Grade scale</h2>
          <p className="mt-1 text-sm text-slate-500">
            Each band starts at a percentage and runs until the next band
            begins. One band must start at 0%.
          </p>
        </div>

        <BandsEditor initial={bands} />
      </section>
    </div>
  );
}

function GradingFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function GradingPage() {
  return (
    <Suspense fallback={<GradingFallback />}>
      <GradingContent />
    </Suspense>
  );
}
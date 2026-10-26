import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmStatusButton } from "@/components/admin/confirm-status-button";
import { BankForm } from "@/components/fees/bank-form";
import { FeeItemSheet } from "@/components/fees/fee-item-sheet";
import { GenerateCharges } from "@/components/fees/generate-charges";
import { SetupSelector } from "@/components/fees/setup-selector";
import { StructureEditor, type OtherClassFees } from "@/components/fees/structure-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TermRaw = {
  id: string;
  name: string;
  academic_sessions: { name: string } | { name: string }[] | null;
};

async function SetupContent({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; termId?: string }>;
}) {
  const { canManage } = await requireAreaAccess("fees");
  const query = await searchParams;
  const admin = createAdminClient();

  const [itemsResult, classesResult, termsResult, settingsResult, currentTerm] =
    await Promise.all([
      admin
        .from("fee_items")
        .select("id, name, description, is_active")
        .order("name", { ascending: true }),
      admin
        .from("classes")
        .select("id, name")
        .eq("is_active", true)
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      admin
        .from("academic_terms")
        .select("id, name, academic_sessions(name)")
        .order("start_date", { ascending: false }),
      admin
        .from("fee_settings")
        .select("bank_name, account_name, account_number, note")
        .maybeSingle(),
      getCurrentTerm(),
    ]);

  const failed =
    itemsResult.error ??
    classesResult.error ??
    termsResult.error ??
    settingsResult.error;

  if (failed) {
    console.error("Unable to load fee setup:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the fee setup. Please refresh the page.
        </div>
      </div>
    );
  }

  const items = itemsResult.data ?? [];
  const classes = (classesResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
  }));
  const terms = ((termsResult.data ?? []) as unknown as TermRaw[]).map((item) => {
    const session = Array.isArray(item.academic_sessions)
      ? item.academic_sessions[0]
      : item.academic_sessions;

    return { id: item.id, label: `${item.name}, ${session?.name ?? ""}` };
  });

  const wantedClass = z.uuid().safeParse(query.classId);
  const wantedTerm = z.uuid().safeParse(query.termId);

  const classId =
    wantedClass.success && classes.some((item) => item.id === wantedClass.data)
      ? wantedClass.data
      : (classes[0]?.id ?? "");
  const termId =
    wantedTerm.success && terms.some((item) => item.id === wantedTerm.data)
      ? wantedTerm.data
      : (currentTerm?.id ?? terms[0]?.id ?? "");

  const className = classes.find((item) => item.id === classId)?.name ?? "";
  const termLabel = terms.find((item) => item.id === termId)?.label ?? "";

  let initial: Record<string, string> = {};
  let others: OtherClassFees[] = [];

  if (classId && termId) {
    const structureResult = await admin
      .from("fee_structure")
      .select("class_id, item_id, amount")
      .eq("term_id", termId);

    if (structureResult.error) {
      console.error("Unable to load the structure:", structureResult.error.message);

      return (
        <div className="p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            We couldn&apos;t load the fee structure. Please refresh the page.
          </div>
        </div>
      );
    }

    const byClass = new Map<string, Record<string, string>>();

    for (const row of structureResult.data ?? []) {
      const entry = byClass.get(row.class_id as string) ?? {};
      entry[row.item_id as string] = String(Number(row.amount));
      byClass.set(row.class_id as string, entry);
    }

    initial = byClass.get(classId) ?? {};
    others = classes
      .filter((item) => item.id !== classId && byClass.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        amounts: byClass.get(item.id) ?? {},
      }));
  }

  const activeItems = items
    .filter((item) => item.is_active)
    .map((item) => ({ id: item.id as string, name: item.name as string }));

  const bank = settingsResult.data;

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/fees"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to fees
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Fee setup</h1>
        <p className="text-sm text-slate-500">
          What the school charges, how much per class and term, and where
          parents should pay.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Fee items</h2>
            <p className="mt-1 text-sm text-slate-500">
              The things you charge for. Deactivating one stops it counting in
              new charges.
            </p>
          </div>
          {canManage ? <FeeItemSheet /> : null}
        </div>

        <div className="rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                    No fee items yet. For example: Tuition, Books, Uniform.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id as string} className={item.is_active ? "" : "opacity-60"}>
                    <TableCell className="font-medium text-slate-900">{item.name as string}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {(item.description as string | null) ?? "-"}
                    </TableCell>
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
                      {canManage ? (
                        <div className="flex justify-end gap-2">
                          <FeeItemSheet
                            item={{
                              id: item.id as string,
                              name: item.name as string,
                              description: (item.description as string | null) ?? "",
                            }}
                          />
                          <ConfirmStatusButton
                            url={`/api/admin/fees/items/${item.id as string}`}
                            name={item.name as string}
                            isActive={item.is_active as boolean}
                            deactivateMessage="It won't count in new charges. Charges already generated keep it. You can reactivate it anytime."
                            reactivateMessage="It will count in new charges again."
                          />
                        </div>
                      ) : null}
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
          <h2 className="text-sm font-semibold text-slate-900">Fees per class and term</h2>
          <p className="mt-1 text-sm text-slate-500">
            Set the amount for each item. Leave an item empty to not charge it
            to that class. After saving, generate the charges.
          </p>
        </div>

        {classes.length === 0 || terms.length === 0 ? (
          <p className="text-sm text-slate-600">
            You need at least one active class and one academic term first.
          </p>
        ) : (
          <>
            <SetupSelector classes={classes} terms={terms} classId={classId} termId={termId} />

            <fieldset disabled={!canManage} className="m-0 min-w-0 border-0 p-0">
              <StructureEditor
                key={`${classId}-${termId}-${JSON.stringify(initial)}`}
                classId={classId}
                termId={termId}
                items={activeItems}
                initial={initial}
                others={others}
              />
            </fieldset>

            {canManage ? (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-600">
                  Charges are frozen when generated. Generate again later to
                  charge students who joined after the first run.
                </p>
                <GenerateCharges
                  classId={classId}
                  termId={termId}
                  className={className}
                  termLabel={termLabel}
                />
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Bank details</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shown to students and parents in the portal&apos;s Fees tab.
          </p>
        </div>

        <fieldset disabled={!canManage} className="m-0 min-w-0 border-0 p-0">
          <BankForm
            initial={{
              bankName: (bank?.bank_name as string | null) ?? "",
              accountName: (bank?.account_name as string | null) ?? "",
              accountNumber: (bank?.account_number as string | null) ?? "",
              note: (bank?.note as string | null) ?? "",
            }}
          />
        </fieldset>
      </section>
    </div>
  );
}

function SetupFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function FeeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; termId?: string }>;
}) {
  return (
    <Suspense fallback={<SetupFallback />}>
      <SetupContent searchParams={searchParams} />
    </Suspense>
  );
}
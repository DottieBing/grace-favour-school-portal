import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmStatusButton } from "@/components/admin/confirm-status-button";
import { SubjectSheet } from "@/components/subjects/subject-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
};

async function SubjectsContent() {
  await requireAreaAccess("classes");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("subjects")
    .select("id, name, code, description, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Unable to load subjects:", error.message);
  }

  const subjects = (data ?? []) as SubjectRow[];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Subjects</h1>
          <p className="text-sm text-slate-500">
            The subjects your school teaches. Deactivate a subject you no longer
            offer. Its past records stay.
          </p>
        </div>
        <SubjectSheet />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the subjects. Please refresh the page.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-slate-500"
                  >
                    No subjects yet. Use “Add subject” to create the first one.
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((subject) => (
                  <TableRow
                    key={subject.id}
                    className={subject.is_active ? "" : "opacity-60"}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {subject.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {subject.code ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-slate-600">
                      {subject.description ?? "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          subject.is_active
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        }
                      >
                        {subject.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <SubjectSheet
                          subject={{
                            id: subject.id,
                            name: subject.name,
                            code: subject.code ?? "",
                            description: subject.description ?? "",
                          }}
                        />
                        <ConfirmStatusButton
                          url={`/api/admin/subjects/${subject.id}`}
                          name={subject.name}
                          isActive={subject.is_active}
                          deactivateMessage="It won't be available for new class setups or teacher assignments. Existing results and records stay, and you can reactivate it anytime."
                          reactivateMessage="It will be available again for classes and teacher assignments."
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SubjectsFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function SubjectsPage() {
  return (
    <Suspense fallback={<SubjectsFallback />}>
      <SubjectsContent />
    </Suspense>
  );
}
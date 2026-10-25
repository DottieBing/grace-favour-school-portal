import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { levelLabel } from "@/lib/academic/levels";
import { ConfirmStatusButton } from "@/components/admin/confirm-status-button";
import { ClassSheet } from "@/components/classes/class-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ClickableRow } from "@/components/admin/clickable-row";

type ClassRow = {
  id: string;
  name: string;
  level_number: number;
  section: string | null;
  capacity: number | null;
  is_active: boolean;
};

async function ClassesContent() {
  const { canManage } = await requireAreaAccess("classes");

  const admin = createAdminClient();

  const [classesResult, studentsResult] = await Promise.all([
    admin
      .from("classes")
      .select("id, name, level_number, section, capacity, is_active")
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    admin
      .from("students")
      .select("current_class_id")
      .eq("status", "active")
      .not("current_class_id", "is", null),
  ]);

  if (classesResult.error) {
    console.error("Unable to load classes:", classesResult.error.message);
  }

  if (studentsResult.error) {
    console.error("Unable to load students:", studentsResult.error.message);
  }

  const classes = (classesResult.data ?? []) as ClassRow[];

  const counts = new Map<string, number>();

  for (const row of studentsResult.data ?? []) {
    const classId = row.current_class_id as string;
    counts.set(classId, (counts.get(classId) ?? 0) + 1);
  }

  const failed = Boolean(classesResult.error);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Classes</h1>
          <p className="text-sm text-slate-500">
            Nursery 1 to Primary 6. Add an arm (A, B, C) when a level needs more
            than one class.
          </p>
        </div>
        {canManage ? <ClassSheet /> : null}
      </div>

      {failed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the classes. Please refresh the page.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-slate-500"
                  >
                    No classes yet. Use “Add class” to create the first one.
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((item) => {
                  const students = counts.get(item.id) ?? 0;

                  return (
                    <ClickableRow
                      key={item.id}
                      href={`/admin/classes/${item.id}`}
                      className={item.is_active ? "" : "opacity-60"}
                    >
                      <TableCell className="font-medium text-slate-900">
                        <Link
                          href={`/admin/classes/${item.id}`}
                          className="hover:text-[#0D5C63] hover:underline"
                        >
                          {item.name}
                        </Link>
                      </TableCell>
                      <TableCell>{levelLabel(item.level_number)}</TableCell>
                      <TableCell>
                        {students}
                        {item.capacity ? ` / ${item.capacity}` : ""}
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
                          <ClassSheet
                            cls={{
                              id: item.id,
                              levelNumber: item.level_number,
                              section: item.section ?? "",
                              capacity: item.capacity,
                            }}
                          />
                          <ConfirmStatusButton
                            url={`/api/admin/classes/${item.id}`}
                            name={item.name}
                            isActive={item.is_active}
                            deactivateMessage="The class will be hidden from new work. A class with active students can't be deactivated. Move them first. You can reactivate it anytime."
                            reactivateMessage="The class will be available again."
                          />
                        </div>
                        ) : null}
                      </TableCell>
                    </ClickableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ClassesFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function ClassesPage() {
  return (
    <Suspense fallback={<ClassesFallback />}>
      <ClassesContent />
    </Suspense>
  );
}
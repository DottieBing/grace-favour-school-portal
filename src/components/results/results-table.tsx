"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  PublishButton,
  ReopenResultButton,
} from "@/components/results/result-actions";
import { StatusBadge } from "@/components/results/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SheetState } from "@/lib/results/types";
import { ClickableRow } from "../admin/clickable-row";

export type ResultRow = {
  key: string;
  sheetId: string | null;
  classId: string;
  className: string;
  subjectName: string;
  teacherName: string;
  state: SheetState;
};

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function ResultsTable({
  rows,
  classes,
  canManage,
}: {
  rows: ResultRow[];
  classes: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [classId, setClassId] = useState("all");
  const [state, setState] = useState<"all" | SheetState>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (classId === "all" || row.classId === classId) &&
          (state === "all" || row.state === state),
      ),
    [rows, classId, state],
  );

  const selectable = filtered
    .filter((row) => canManage && row.state === "submitted" && row.sheetId)
    .map((row) => row.sheetId as string);

  const allSelected =
    selectable.length > 0 && selectable.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function toggleAll() {
    setSelected((previous) => {
      const next = new Set(previous);

      if (allSelected) selectable.forEach((id) => next.delete(id));
      else selectable.forEach((id) => next.add(id));

      return next;
    });
  }

  const chosen = [...selected];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className={selectClass}
          aria-label="Filter by class"
        >
          <option value="all">All classes</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          value={state}
          onChange={(event) => setState(event.target.value as typeof state)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          <option value="not_started">Not started</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="published">Published</option>
        </select>

                {canManage ? (
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {chosen.length} selected
          </span>
          <PublishButton
            sheetIds={chosen}
            label={`Publish ${chosen.length} selected`}
            onDone={() => setSelected(new Set())}
          />
        </div>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                className="size-4"
                checked={allSelected}
                disabled={selectable.length === 0}
                onChange={toggleAll}
                aria-label="Select all submitted sheets shown"
                hidden={!canManage}
              />
            </TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Teacher</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-12 text-center text-sm text-slate-500"
              >
                {rows.length === 0
                  ? "No teachers are assigned to subjects yet. Assign them on each class page."
                  : "No sheets match your filters."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
              <ClickableRow
                key={row.key}
                href={row.sheetId ? `/admin/results/${row.sheetId}` : null}
              >
                <TableCell>
                  {canManage && row.state === "submitted" && row.sheetId ? (
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(row.sheetId)}
                      onChange={() => toggle(row.sheetId as string)}
                      aria-label={`Select ${row.className} ${row.subjectName}`}
                    />
                  ) : null}
                </TableCell>
                <TableCell className="font-medium text-slate-900">
                  {row.className}
                </TableCell>
                <TableCell>{row.subjectName}</TableCell>
                <TableCell>{row.teacherName}</TableCell>
                <TableCell>
                  <StatusBadge state={row.state} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canManage && row.state === "submitted" && row.sheetId ? (
                      <ReopenResultButton
                        sheetId={row.sheetId}
                        label={`${row.className} ${row.subjectName}`}
                      />
                    ) : null}
                    {row.sheetId ? (
                      <Link
                        href={`/admin/results/${row.sheetId}`}
                        className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                </TableCell>
              </ClickableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
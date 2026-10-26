"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { ClickableRow } from "@/components/admin/clickable-row";
import { FeeStatusBadge } from "@/components/fees/status-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { naira } from "@/lib/fees/money";
import { FEE_STATUS_LABELS, type FeeStatus } from "@/lib/fees/status";

export type FeeRow = {
  id: string;
  name: string;
  admissionNumber: string;
  classId: string | null;
  className: string | null;
  owed: number;
  paid: number;
  balance: number;
  status: FeeStatus;
};

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function FeesTable({
  rows,
  classes,
}: {
  rows: FeeRow[];
  classes: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState<"all" | FeeStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (classId !== "all" && row.classId !== classId) return false;
      if (status !== "all" && row.status !== status) return false;
      if (!q) return true;

      return (
        row.name.toLowerCase().includes(q) ||
        row.admissionNumber.toLowerCase().includes(q)
      );
    });
  }, [rows, query, classId, status]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or admission number"
            className="pl-9"
          />
        </div>

        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectClass} aria-label="Filter by class">
          <option value="all">All classes</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          {(Object.keys(FEE_STATUS_LABELS) as FeeStatus[]).map((key) => (
            <option key={key} value={key}>
              {FEE_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Owed</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">
                {rows.length === 0
                  ? "No active students yet."
                  : "No students match your search or filters."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
              <ClickableRow key={row.id} href={`/admin/fees/students/${row.id}`}>
                <TableCell>
                  <Link
                    href={`/admin/fees/students/${row.id}`}
                    className="font-medium text-slate-900 hover:text-[#0D5C63] hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="font-mono text-xs text-slate-500">{row.admissionNumber}</div>
                </TableCell>
                <TableCell>{row.className ?? "-"}</TableCell>
                <TableCell>{naira(row.owed)}</TableCell>
                <TableCell>{naira(row.paid)}</TableCell>
                <TableCell className="font-medium text-slate-900">
                  {row.balance < 0 ? `${naira(-row.balance)} credit` : naira(row.balance)}
                </TableCell>
                <TableCell>
                  <FeeStatusBadge status={row.status} />
                </TableCell>
              </ClickableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
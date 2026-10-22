"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/admin/clickable-row";

export type StudentRow = {
  id: string;
  admissionNumber: string;
  name: string;
  classId: string | null;
  className: string | null;
  guardianPhone: string | null;
  status: "active" | "withdrawn" | "transferred" | "graduated";
};

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

const STATUS_LABELS: Record<StudentRow["status"], string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  transferred: "Transferred",
  graduated: "Graduated",
};

export function StudentsTable({
  students,
  classes,
}: {
  students: StudentRow[];
  classes: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState<"all" | StudentRow["status"]>("active");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return students.filter((student) => {
      if (status !== "all" && student.status !== status) return false;
      if (classId !== "all" && student.classId !== classId) return false;

      if (!q) return true;

      return [student.name, student.admissionNumber, student.guardianPhone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [students, query, classId, status]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, admission number or guardian phone"
            className="pl-9"
          />
        </div>

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
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="transferred">Transferred</option>
          <option value="graduated">Graduated</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Admission no.</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Guardian phone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-12 text-center text-sm text-slate-500"
              >
                {students.length === 0
                  ? "No students yet. Use “Add student” to register the first one."
                  : "No students match your search or filters."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((student) => (
              <ClickableRow key={student.id} href={`/admin/students/${student.id}`}>
                <TableCell>
                  <Link
                    href={`/admin/students/${student.id}`}
                    className="font-medium text-slate-900 hover:text-[#0D5C63] hover:underline"
                  >
                    {student.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {student.admissionNumber}
                </TableCell>
                <TableCell>{student.className ?? "-"}</TableCell>
                <TableCell>{student.guardianPhone ?? "-"}</TableCell>
                <TableCell>
                  <span
                    className={
                      student.status === "active"
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                    }
                  >
                    {STATUS_LABELS[student.status]}
                  </span>
                </TableCell>
              </ClickableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
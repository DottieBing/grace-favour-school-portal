"use client";

import { useMemo, useState } from "react";
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
import Link from "next/link";

export type StaffRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  staff_number: string;
  job_title: string | null;
  department: string | null;
  staff_type: "teaching" | "non_teaching";
  is_active: boolean;
  employment_date: string | null;
};

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StaffTable({ staff }: { staff: StaffRow[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "teaching" | "non_teaching">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return staff.filter((member) => {
      if (type !== "all" && member.staff_type !== type) return false;
      if (status === "active" && !member.is_active) return false;
      if (status === "inactive" && member.is_active) return false;

      if (!q) return true;

      return [
        member.full_name,
        member.staff_number,
        member.job_title,
        member.department,
        member.email,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [staff, query, type, status]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, staff number, title or department"
            className="pl-9"
          />
        </div>

        <select
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
          className={selectClass}
          aria-label="Filter by staff type"
        >
          <option value="all">All staff</option>
          <option value="teaching">Teaching</option>
          <option value="non_teaching">Non-teaching</option>
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Staff no.</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Portal access</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-12 text-center text-sm text-slate-500"
              >
                {staff.length === 0
                  ? "No staff yet. Use “Add staff” to create the first record."
                  : "No staff match your search or filters."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Link
                    href={`/admin/staff/${member.id}`}
                    className="font-medium text-slate-900 hover:text-[#0D5C63] hover:underline"
                  >
                    {member.full_name ?? "Unnamed"}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {member.email ?? member.phone ?? ""}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {member.staff_number}
                </TableCell>
                <TableCell>
                  <div>{member.job_title ?? "-"}</div>
                  {member.department ? (
                    <div className="text-xs text-slate-500">
                      {member.department}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {member.staff_type === "teaching"
                    ? "Teaching"
                    : "Non-teaching"}
                </TableCell>
                <TableCell>{member.user_id ? "Yes" : "No"}</TableCell>
                <TableCell>{formatDate(member.employment_date)}</TableCell>
                <TableCell>
                  <span
                    className={
                      member.is_active
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                    }
                  >
                    {member.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
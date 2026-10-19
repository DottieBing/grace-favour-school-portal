"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConfirmStatusButton } from "@/components/admin/confirm-status-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AssignmentItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherActive: boolean;
  subjectName: string;
  isClassTeacher: boolean;
};

export type TeacherOption = {
  id: string;
  name: string;
  staffNumber: string;
};

export type SubjectChoice = { id: string; name: string };

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

async function send(
  url: string,
  method: string,
  body: unknown,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) return null;

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    return data.error ?? "Something went wrong. Please try again.";
  } catch {
    return "Network error. Check your connection and try again.";
  }
}

export function ClassTeachers({
  classId,
  assignments,
  teachers,
  subjectChoices,
}: {
  classId: string;
  assignments: AssignmentItem[];
  teachers: TeacherOption[];
  subjectChoices: SubjectChoice[];
}) {
  const router = useRouter();

  const currentClassTeacher =
    assignments.find((item) => item.isClassTeacher)?.teacherId ?? "";

  const [classTeacher, setClassTeacher] = useState(currentClassTeacher);
  const [teacherId, setTeacherId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teachers who already teach something in this class can be class teacher.
  const teachersHere = new Map<string, string>();

  for (const item of assignments) {
    teachersHere.set(item.teacherId, item.teacherName);
  }

  function togglePicked(subjectId: string) {
    setPicked((previous) => {
      const next = new Set(previous);

      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }

      return next;
    });
  }

  async function saveClassTeacher() {
    setBusy(true);
    setError(null);

    const problem = await send(
      `/api/admin/classes/${classId}/class-teacher`,
      "PUT",
      { teacherId: classTeacher === "" ? null : classTeacher },
    );

    setBusy(false);

    if (problem) {
      setError(problem);
      return;
    }

    router.refresh();
  }

  async function assign() {
    if (!teacherId || picked.size === 0) return;

    setBusy(true);
    setError(null);

    const problem = await send(
      `/api/admin/classes/${classId}/assignments`,
      "POST",
      { teacherId, subjectIds: [...picked] },
    );

    setBusy(false);

    if (problem) {
      setError(problem);
      return;
    }

    setPicked(new Set());
    setTeacherId("");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Class teacher</h3>

        {teachersHere.size === 0 ? (
          <p className="text-sm text-slate-500">
            Assign a teacher to a subject first, then choose the class teacher
            from them.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              className={selectClass}
              value={classTeacher}
              onChange={(event) => setClassTeacher(event.target.value)}
              aria-label="Class teacher"
            >
              <option value="">No class teacher</option>
              {[...teachersHere.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={saveClassTeacher}
              disabled={busy || classTeacher === currentClassTeacher}
            >
              Save class teacher
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Subject teachers</h3>

        <div className="rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-sm text-slate-500"
                  >
                    No teachers assigned yet.
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-slate-900">
                      {item.subjectName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{item.teacherName}</span>
                        {item.isClassTeacher ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Class teacher
                          </span>
                        ) : null}
                        {!item.teacherActive ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ConfirmStatusButton
                          url={`/api/admin/assignments/${item.id}`}
                          name={`${item.teacherName} from ${item.subjectName}`}
                          isActive
                          deactivateMessage="They will no longer teach this subject in this class. Past records stay. You can assign them again anytime."
                          reactivateMessage=""
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Assign a teacher</h3>

        {subjectChoices.length === 0 ? (
          <p className="text-sm text-slate-500">
            Every subject this class takes already has a teacher.
          </p>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No active teachers yet. Add teaching staff on the Staff page.
          </p>
        ) : (
          <div className="space-y-4">
            <select
              className={`${selectClass} w-full sm:w-72`}
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              aria-label="Teacher"
            >
              <option value="">Choose a teacher...</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.staffNumber})
                </option>
              ))}
            </select>

            <div className="grid gap-2 sm:grid-cols-2">
              {subjectChoices.map((subject) => {
                const checked = picked.has(subject.id);

                return (
                  <label
                    key={subject.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                      checked
                        ? "border-[#0D5C63] bg-[#F1F8F7]"
                        : "border-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePicked(subject.id)}
                      className="size-4"
                    />
                    <span className="text-slate-900">{subject.name}</span>
                  </label>
                );
              })}
            </div>

            <Button
              type="button"
              onClick={assign}
              disabled={busy || !teacherId || picked.size === 0}
            >
              {busy ? "Saving..." : "Assign teacher"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
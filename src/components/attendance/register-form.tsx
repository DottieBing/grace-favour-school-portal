"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AttendanceStatus,
  Mark,
  RegisterStudent,
} from "@/lib/attendance/types";

const OPTIONS: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "present", label: "Present", active: "bg-emerald-600 text-white" },
  { value: "absent", label: "Absent", active: "bg-red-600 text-white" },
  { value: "late", label: "Late", active: "bg-amber-500 text-white" },
];

function defaultMark(): Mark {
  return { status: "present", note: "" };
}

export function RegisterForm({
  classId,
  date,
  students,
  initial,
  endpoint,
  sendDate = false,
  readOnly = false,
  confirmText,
  submitLabel = "Submit register",
}: {
  classId: string;
  date: string;
  students: RegisterStudent[];
  initial: Record<string, Mark>;
  endpoint: string;
  sendDate?: boolean;
  readOnly?: boolean;
  confirmText?: string;
  submitLabel?: string;
}) {
  const router = useRouter();

  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      students.map((student) => [student.id, initial[student.id] ?? defaultMark()]),
    ),
  );
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = { present: 0, absent: 0, late: 0 };

  for (const student of students) {
    counts[(marks[student.id] ?? defaultMark()).status] += 1;
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setSaved(false);
    setMarks((previous) => ({
      ...previous,
      [studentId]: {
        status,
        note: status === "present" ? "" : (previous[studentId]?.note ?? ""),
      },
    }));
  }

  function setNote(studentId: string, note: string) {
    setSaved(false);
    setMarks((previous) => ({
      ...previous,
      [studentId]: { ...(previous[studentId] ?? defaultMark()), note },
    }));
  }

  function markAllPresent() {
    setSaved(false);
    setMarks(
      Object.fromEntries(
        students.map((student) => [student.id, defaultMark()]),
      ),
    );
  }

  async function submit() {
    setConfirming(false);
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          ...(sendDate ? { date } : {}),
          records: students.map((student) => {
            const mark = marks[student.id] ?? defaultMark();

            return {
              studentId: student.id,
              status: mark.status,
              note: mark.status === "present" ? "" : mark.note,
            };
          }),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-emerald-700">
            {counts.present} present
          </span>
          {" · "}
          <span className="font-medium text-red-700">{counts.absent} absent</span>
          {" · "}
          <span className="font-medium text-amber-700">{counts.late} late</span>
        </p>

        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={markAllPresent}
          >
            Mark all present
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {students.map((student) => {
          const mark = marks[student.id] ?? defaultMark();

          return (
            <li
              key={student.id}
              className="space-y-2 rounded-lg border border-slate-200 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {student.name}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {student.admissionNumber}
                  </p>
                </div>

                <div role="group" aria-label={`Attendance for ${student.name}`} className="flex gap-1">
                  {OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={mark.status === option.value}
                      disabled={readOnly}
                      onClick={() => setStatus(student.id, option.value)}
                      className={`h-9 min-w-[4.5rem] rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-default ${
                        mark.status === option.value
                          ? option.active
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:hover:bg-slate-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {!readOnly && mark.status !== "present" ? (
                <Input
                  value={mark.note}
                  onChange={(event) => setNote(student.id, event.target.value)}
                  placeholder="Note (optional), e.g. sick"
                  maxLength={200}
                  aria-label={`Note for ${student.name}`}
                />
              ) : null}

              {readOnly && mark.status !== "present" && mark.note ? (
                <p className="text-xs text-slate-500">Note: {mark.note}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {saved && !readOnly ? (
        <p className="text-sm text-emerald-700">Register saved.</p>
      ) : null}

      {!readOnly ? (
        confirming ? (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{confirmText}</p>
            <div className="flex gap-3">
              <Button type="button" onClick={submit} disabled={saving}>
                Yes, submit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            disabled={saving}
            onClick={() => (confirmText ? setConfirming(true) : submit())}
          >
            {saving ? "Saving..." : submitLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, List, PartyPopper, Users } from "lucide-react";

import { RegisterForm } from "@/components/attendance/register-form";
import { Avatar } from "@/components/kit/avatar";
import { Confetti } from "@/components/kit/confetti";
import { ProgressRing } from "@/components/kit/progress-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttendanceStatus, Mark, RegisterStudent } from "@/lib/attendance/types";

type Phase = "call" | "review" | "done";

const CHIPS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: "present", label: "Present", on: "bg-emerald-600 text-white" },
  { value: "late", label: "Late", on: "bg-amber-500 text-white" },
  { value: "absent", label: "Absent", on: "bg-red-600 text-white" },
];

function RollCall({
  classId,
  students,
  initial,
  endpoint,
  confirmText,
}: {
  classId: string;
  students: RegisterStudent[];
  initial: Record<string, Mark>;
  endpoint: string;
  confirmText: string;
}) {
  const router = useRouter();
  const complete = students.every((student) => initial[student.id]);

  const [marks, setMarks] = useState<Record<string, Mark>>({ ...initial });
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(complete ? "review" : "call");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const student = students[index];
  const markedCount = students.filter((item) => marks[item.id]).length;

  const counts = { present: 0, late: 0, absent: 0 };

  for (const item of students) {
    const mark = marks[item.id];
    if (mark) counts[mark.status] += 1;
  }

  function setStatus(id: string, status: AttendanceStatus) {
    setMarks((previous) => ({
      ...previous,
      [id]: { status, note: status === "present" ? "" : (previous[id]?.note ?? "") },
    }));
  }

  function choose(status: AttendanceStatus) {
    if (busy.current || !student) return;

    busy.current = true;
    setStatus(student.id, status);

    timer.current = setTimeout(() => {
      busy.current = false;

      if (index < students.length - 1) setIndex((value) => value + 1);
      else setPhase("review");
    }, 220);
  }

  function allPresent() {
    setMarks(
      Object.fromEntries(
        students.map((item) => [item.id, { status: "present" as const, note: "" }]),
      ),
    );
    setPhase("review");
  }

  async function submit() {
    setConfirming(false);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          records: students.map((item) => {
            const mark = marks[item.id] ?? { status: "present" as const, note: "" };

            return {
              studentId: item.id,
              status: mark.status,
              note: mark.status === "present" ? "" : mark.note,
            };
          }),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setPhase("done");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "done") {
    return (
      <div className="anim-pop mx-auto max-w-md space-y-5 py-6 text-center">
        <Confetti />
        <ProgressRing value={1} size={120} stroke={10} color="#16A34A">
          <PartyPopper className="size-10 text-emerald-600" />
        </ProgressRing>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Register submitted</h2>
          <p className="mt-1 text-sm text-slate-500">Thank you. Today&apos;s attendance is in.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Present", counts.present, "bg-emerald-50 text-emerald-700"],
            ["Late", counts.late, "bg-amber-50 text-amber-700"],
            ["Absent", counts.absent, "bg-red-50 text-red-700"],
          ].map(([label, value, style]) => (
            <div key={label as string} className={`rounded-2xl p-3 ${style}`}>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-xs">{label}</div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          onClick={() => {
            router.push("/teacher");
            router.refresh();
          }}
          className="h-11 rounded-full px-6"
        >
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Present", counts.present, "bg-emerald-50 text-emerald-700"],
            ["Late", counts.late, "bg-amber-50 text-amber-700"],
            ["Absent", counts.absent, "bg-red-50 text-red-700"],
          ].map(([label, value, style]) => (
            <div key={label as string} className={`rounded-2xl p-3 text-center ${style}`}>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-xs">{label}</div>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          Check the list, change anyone that needs it, and add a note for absences if you like.
        </p>

        <ul className="space-y-2">
          {students.map((item) => {
            const mark = marks[item.id] ?? { status: "present" as const, note: "" };

            return (
              <li key={item.id} className="space-y-2 rounded-2xl border border-black/5 bg-white p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={item.name} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {item.name}
                  </span>
                  <div className="flex gap-1" role="group" aria-label={`Attendance for ${item.name}`}>
                    {CHIPS.map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        aria-pressed={mark.status === chip.value}
                        onClick={() => setStatus(item.id, chip.value)}
                        className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
                          mark.status === chip.value
                            ? chip.on
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
                {mark.status !== "present" ? (
                  <Input
                    value={mark.note}
                    maxLength={200}
                    placeholder="Note (optional), e.g. sick"
                    aria-label={`Note for ${item.name}`}
                    onChange={(event) =>
                      setMarks((previous) => ({
                        ...previous,
                        [item.id]: { status: mark.status, note: event.target.value },
                      }))
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {confirming ? (
          <div className="anim-pop space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{confirmText}</p>
            <div className="flex gap-3">
              <Button type="button" onClick={submit} disabled={saving} className="rounded-full">
                {saving ? "Submitting..." : "Yes, submit"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} className="rounded-full">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setConfirming(true)} disabled={saving} className="h-11 rounded-full px-6">
              Submit register
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full px-5"
              onClick={() => {
                setIndex(0);
                setPhase("call");
              }}
            >
              Back to roll call
            </Button>
          </div>
        )}
      </div>
    );
  }

  const current = marks[student.id];

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Roll call</p>
          <p className="text-xs text-slate-500">Tap a button for each student</p>
        </div>
        <ProgressRing value={markedCount / students.length} size={56} stroke={6}>
          <span className="text-xs font-semibold text-slate-900">
            {index + 1}/{students.length}
          </span>
        </ProgressRing>
      </div>

      <div
        key={student.id}
        className="anim-slide rounded-3xl border border-black/5 bg-white p-6 text-center shadow-sm"
      >
        <Avatar name={student.name} size={96} className="mx-auto" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">{student.name}</h2>
        <p className="font-mono text-xs text-slate-500">{student.admissionNumber}</p>
        {current ? (
          <p className="mt-2 text-xs text-slate-400">
            Currently marked {current.status}. Tap to change.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => choose("present")}
          className={`h-16 w-full rounded-2xl text-lg font-semibold text-white transition active:scale-[0.98] ${
            current?.status === "present" ? "bg-emerald-700 ring-4 ring-emerald-200" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          Present
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => choose("late")}
            className={`h-14 rounded-2xl font-semibold text-white transition active:scale-[0.98] ${
              current?.status === "late" ? "bg-amber-600 ring-4 ring-amber-200" : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            Late
          </button>
          <button
            type="button"
            onClick={() => choose("absent")}
            className={`h-14 rounded-2xl font-semibold text-white transition active:scale-[0.98] ${
              current?.status === "absent" ? "bg-red-700 ring-4 ring-red-200" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            Absent
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 text-slate-600 disabled:opacity-30"
        >
          <ArrowLeft size={16} />
          Previous
        </button>
        <button
          type="button"
          onClick={allPresent}
          className="inline-flex items-center gap-1.5 font-medium text-[#0D5C63] hover:underline"
        >
          <CheckCheck size={16} />
          Everyone is present
        </button>
      </div>
    </div>
  );
}

export function AttendanceExperience({
  classId,
  date,
  students,
  initial,
  endpoint,
  confirmText,
}: {
  classId: string;
  date: string;
  students: RegisterStudent[];
  initial: Record<string, Mark>;
  endpoint: string;
  confirmText: string;
}) {
  const [mode, setMode] = useState<"roll" | "list">("roll");

  return (
    <div className="space-y-5">
      <div className="mx-auto flex w-fit gap-1 rounded-full bg-[#EAF0ED] p-1">
        {(
          [
            ["roll", "Roll call", Users],
            ["list", "List view", List],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === value ? "bg-white text-[#0D5C63] shadow-sm" : "text-slate-600"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {mode === "roll" ? (
        <RollCall
          classId={classId}
          students={students}
          initial={initial}
          endpoint={endpoint}
          confirmText={confirmText}
        />
      ) : (
        <RegisterForm
          classId={classId}
          date={date}
          students={students}
          initial={initial}
          endpoint={endpoint}
          confirmText={confirmText}
        />
      )}
    </div>
  );
}
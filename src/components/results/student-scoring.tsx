"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Lock, Search } from "lucide-react";

import { Avatar } from "@/components/kit/avatar";
import { ProgressRing } from "@/components/kit/progress-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sk, type ScoringSubject } from "@/lib/results/scoring-types";
import type { ResultStudent } from "@/lib/results/types";

type Outcome = {
  subjectId: string;
  status: "submitted" | "incomplete" | "locked" | "failed";
  message?: string;
};

function parse(text: string, max: number): number | null | "invalid" {
  const value = text.trim();

  if (value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0 || number > max) return "invalid";

  return number;
}

export function StudentScoring({
  classId,
  students,
  subjects,
  initial,
}: {
  classId: string;
  students: ResultStudent[];
  subjects: ScoringSubject[];
  initial: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome[] | null>(null);

  const cell = (studentId: string, subject: ScoringSubject, componentId: string) =>
    values[sk(studentId, subject.id, componentId)] ?? "";

  function studentFill(studentId: string) {
    let filled = 0;
    let total = 0;

    for (const subject of subjects) {
      for (const component of subject.components) {
        total += 1;

        const parsed = parse(cell(studentId, subject, component.id), component.max);

        if (parsed !== null && parsed !== "invalid") filled += 1;
      }
    }

    return { filled, total };
  }

  function subjectComplete(subject: ScoringSubject) {
    if (students.length === 0) return false;

    return students.every((student) =>
      subject.components.every((component) => {
        const parsed = parse(cell(student.id, subject, component.id), component.max);
        return parsed !== null && parsed !== "invalid";
      }),
    );
  }

  const completeStudents = students.filter((student) => {
    const fill = studentFill(student.id);
    return fill.total > 0 && fill.filled === fill.total;
  }).length;

  const editable = subjects.filter((item) => !item.locked);
  const readyToSubmit = editable.filter(subjectComplete);

  function setCell(studentId: string, subject: ScoringSubject, componentId: string, value: string) {
    setMessage(null);
    setDirty((previous) => new Set(previous).add(studentId));
    setValues((previous) => ({ ...previous, [sk(studentId, subject.id, componentId)]: value }));
  }

  async function save(go: "stay" | "next") {
    if (!selected) return;

    setError(null);
    setMessage(null);

    const payload: { subjectId: string; componentId: string; score: number | null }[] = [];

    for (const subject of editable) {
      for (const component of subject.components) {
        const parsed = parse(cell(selected, subject, component.id), component.max);

        if (parsed === "invalid") {
          setError(`${subject.name}: ${component.name} must be a number from 0 to ${component.max}.`);
          return;
        }

        payload.push({ subjectId: subject.id, componentId: component.id, score: parsed });
      }
    }

    if (payload.length > 0) {
      setSaving(true);

      try {
        const response = await fetch("/api/teacher/results/student", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, studentId: selected, scores: payload }),
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          setError(data.error ?? "Something went wrong. Please try again.");
          return;
        }

        setDirty((previous) => {
          const next = new Set(previous);
          next.delete(selected);
          return next;
        });
        router.refresh();
      } catch {
        setError("Network error. Check your connection and try again.");
        return;
      } finally {
        setSaving(false);
      }
    }

    if (go === "next") {
      const index = students.findIndex((item) => item.id === selected);
      const following = students[index + 1];

      setSelected(following ? following.id : null);
      setMessage(following ? null : "Saved. That was the last student.");
    } else {
      setMessage("Saved.");
    }
  }

  async function submit(subjectIds: string[]) {
    setSubmitting(true);
    setError(null);
    setOutcome(null);

    try {
      const response = await fetch("/api/teacher/results/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectIds }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        results?: Outcome[];
      };

      if (!response.ok || !data.results) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setConfirm(null);
      setOutcome(data.results);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const nameOf = (id: string) => subjects.find((item) => item.id === id)?.name ?? "Subject";

  if (selected) {
    const student = students.find((item) => item.id === selected);
    const index = students.findIndex((item) => item.id === selected);

    if (!student) return null;

    const fill = studentFill(student.id);

    return (
      <div key={student.id} className="anim-slide space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            All students
          </button>
          <span className="text-xs text-slate-500">
            Student {index + 1} of {students.length}
          </span>
        </div>

        <div className="flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
          <Avatar name={student.name} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-900">{student.name}</h2>
            <p className="font-mono text-xs text-slate-500">{student.admissionNumber}</p>
          </div>
          <ProgressRing value={fill.total === 0 ? 0 : fill.filled / fill.total} size={56} stroke={6}>
            <span className="text-xs font-semibold">
              {fill.filled}/{fill.total}
            </span>
          </ProgressRing>
        </div>

        {subjects.map((subject) => {
          let total = 0;
          let max = 0;
          let complete = true;

          for (const component of subject.components) {
            max += component.max;

            const parsed = parse(cell(student.id, subject, component.id), component.max);

            if (parsed === null || parsed === "invalid") complete = false;
            else total += parsed;
          }

          return (
            <section
              key={subject.id}
              className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{subject.name}</h3>
                {subject.locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    <Lock size={12} />
                    {subject.state === "published" ? "Published" : "Submitted"}
                  </span>
                ) : complete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                    <Check size={12} />
                    {Math.round((total / max) * 100)}%
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {subject.components.map((component) => {
                  const value = cell(student.id, subject, component.id);
                  const bad = parse(value, component.max) === "invalid";

                  return (
                    <label key={component.id} className="space-y-1">
                      <span className="block text-xs text-slate-500">
                        {component.name} <span className="text-slate-400">/ {component.max}</span>
                      </span>
                      {subject.locked ? (
                        <span className="block h-9 rounded-md bg-slate-50 px-2.5 py-2 text-sm text-slate-900">
                          {value === "" ? "-" : value}
                        </span>
                      ) : (
                        <Input
                          value={value}
                          inputMode="decimal"
                          aria-invalid={bad || undefined}
                          onChange={(event) =>
                            setCell(student.id, subject, component.id, event.target.value)
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={saving} onClick={() => save("next")} className="h-11 rounded-full px-6">
            {saving ? "Saving..." : index === students.length - 1 ? "Save" : "Save and next"}
            {!saving && index < students.length - 1 ? <ArrowRight size={16} /> : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => save("stay")}
            className="h-11 rounded-full px-5"
          >
            Save only
          </Button>
          {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
        </div>
      </div>
    );
  }

  const shown = students.filter((item) => {
    const q = query.trim().toLowerCase();

    return q === "" || item.name.toLowerCase().includes(q) || item.admissionNumber.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
        <ProgressRing value={students.length === 0 ? 0 : completeStudents / students.length} size={72}>
          <span className="text-sm font-semibold">
            {completeStudents}/{students.length}
          </span>
        </ProgressRing>
        <div>
          <p className="font-semibold text-slate-900">
            {students.length === 0
              ? "No students in this class yet"
              : completeStudents === students.length
                ? "Every student is scored"
                : `${completeStudents} of ${students.length} students fully scored`}
          </p>
          <p className="text-sm text-slate-500">Tap a student to score all their subjects.</p>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {students.length > 0 ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students"
              className="h-10 rounded-full pl-9"
            />
          </div>

          <ul className="space-y-2">
            {shown.map((student) => {
              const fill = studentFill(student.id);
              const done = fill.total > 0 && fill.filled === fill.total;

              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(student.id);
                      setError(null);
                      setMessage(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 text-left shadow-sm transition hover:bg-[#F4F7F5] active:scale-[0.99]"
                  >
                    <Avatar name={student.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{student.name}</span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={`block h-full rounded-full ${done ? "bg-emerald-500" : "bg-[#0D5C63]"}`}
                          style={{ width: `${fill.total === 0 ? 0 : (fill.filled / fill.total) * 100}%` }}
                        />
                      </span>
                    </span>
                    {done ? (
                      <Check className="size-5 text-emerald-600" />
                    ) : (
                      <span className="text-xs text-slate-500">
                        {fill.filled}/{fill.total}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {subjects.length > 0 ? (
        <section className="space-y-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
          <div>
            <h3 className="font-semibold text-slate-900">Submit results</h3>
            <p className="text-sm text-slate-500">
              A subject can be submitted once every student has every score. Submitting locks it.
              {dirty.size > 0 ? " Save the student you're editing first." : ""}
            </p>
          </div>

          <ul className="divide-y divide-slate-100">
            {subjects.map((subject) => {
              const complete = subjectComplete(subject);

              return (
                <li key={subject.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{subject.name}</p>
                    <p className="text-xs text-slate-500">
                      {subject.locked
                        ? subject.state === "published"
                          ? "Published"
                          : "Submitted and locked"
                        : complete
                          ? "Ready to submit"
                          : "Some scores are missing"}
                    </p>
                  </div>
                  {subject.locked ? (
                    <Lock className="size-4 text-slate-400" />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!complete || dirty.size > 0 || submitting}
                      onClick={() => setConfirm([subject.id])}
                    >
                      Submit
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {editable.length > 1 ? (
            <Button
              type="button"
              disabled={readyToSubmit.length === 0 || dirty.size > 0 || submitting}
              onClick={() => setConfirm(readyToSubmit.map((item) => item.id))}
              className="h-11 rounded-full px-6"
            >
              Submit all complete subjects ({readyToSubmit.length})
            </Button>
          ) : null}

          {confirm ? (
            <div className="anim-pop space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>
                Submit {confirm.map(nameOf).join(", ")}? You won&apos;t be able to change{" "}
                {confirm.length === 1 ? "it" : "them"} afterwards. The administrator can reopen{" "}
                {confirm.length === 1 ? "it" : "them"} if something is wrong.
              </p>
              <div className="flex gap-3">
                <Button type="button" disabled={submitting} onClick={() => submit(confirm)} className="rounded-full">
                  {submitting ? "Submitting..." : "Yes, submit"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirm(null)} className="rounded-full">
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {outcome ? (
            <ul className="space-y-1 text-sm">
              {outcome.map((item) => (
                <li
                  key={item.subjectId}
                  className={item.status === "submitted" ? "text-emerald-700" : "text-amber-700"}
                >
                  {nameOf(item.subjectId)}: {item.status === "submitted" ? "submitted" : item.message}
                </li>
              ))}
            </ul>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
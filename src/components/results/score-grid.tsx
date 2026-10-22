"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  scoreKey,
  type GradeInfo,
  type ResultStudent,
  type ScoreComponent,
} from "@/lib/results/types";

function parse(value: string, max: number): number | null | "invalid" {
  const text = value.trim();

  if (text === "") return null;

  const number = Number(text);

  if (!Number.isFinite(number) || number < 0 || number > max) return "invalid";

  return number;
}

export function ScoreGrid({
  classId,
  subjectId,
  students,
  components,
  initial,
  grades,
  readOnly = false,
  endpoint = "/api/teacher/results",
  confirmText,
}: {
  classId: string;
  subjectId: string;
  students: ResultStudent[];
  components: ScoreComponent[];
  initial: Record<string, string>;
  grades?: Record<string, GradeInfo>;
  readOnly?: boolean;
  endpoint?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxTotal = components.reduce((sum, item) => sum + item.max, 0);
  const showGrades = grades && Object.keys(grades).length > 0;

  function stats(studentId: string) {
    let total = 0;
    let filled = 0;
    let invalid = false;

    for (const component of components) {
      const parsed = parse(
        values[scoreKey(studentId, component.id)] ?? "",
        component.max,
      );

      if (parsed === "invalid") invalid = true;
      else if (parsed !== null) {
        total += parsed;
        filled += 1;
      }
    }

    const complete = filled === components.length && !invalid;

    return {
      total: Math.round(total * 100) / 100,
      filled,
      invalid,
      percent: complete
        ? Math.round((total / maxTotal) * 10000) / 100
        : null,
    };
  }

  let missing = 0;

  for (const student of students) {
    missing += components.length - stats(student.id).filled;
  }

  function setValue(key: string, value: string) {
    setMessage(null);
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function send(submit: boolean) {
    setConfirming(false);
    setError(null);
    setMessage(null);

    const scores: {
      studentId: string;
      componentId: string;
      score: number | null;
    }[] = [];

    for (const student of students) {
      for (const component of components) {
        const parsed = parse(
          values[scoreKey(student.id, component.id)] ?? "",
          component.max,
        );

        if (parsed === "invalid") {
          setError(
            "Some scores are invalid. Scores must be numbers from 0 up to the maximum shown in the column heading.",
          );
          return;
        }

        scores.push({
          studentId: student.id,
          componentId: component.id,
          score: parsed,
        });
      }
    }

    if (submit && missing > 0) {
      setError(
        `${missing} score${missing === 1 ? " is" : "s are"} still empty. Enter every score before submitting, using 0 where it applies.`,
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectId, submit, scores }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setMessage(data.message ?? "Saved.");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">Student</th>
              {components.map((component) => (
                <th key={component.id} className="px-3 py-2 font-medium">
                  {component.name}
                  <span className="block font-normal text-slate-400">
                    out of {component.max}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">
                Total
                <span className="block font-normal text-slate-400">
                  out of {maxTotal}
                </span>
              </th>
              <th className="px-3 py-2 font-medium">%</th>
              {showGrades ? (
                <th className="px-3 py-2 font-medium">Grade</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const row = stats(student.id);
              const grade = grades?.[student.id];

              return (
                <tr key={student.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">
                      {student.name}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      {student.admissionNumber}
                    </div>
                  </td>

                  {components.map((component) => {
                    const key = scoreKey(student.id, component.id);
                    const value = values[key] ?? "";
                    const bad = parse(value, component.max) === "invalid";

                    return (
                      <td key={component.id} className="px-3 py-2">
                        {readOnly ? (
                          <span className="text-slate-900">
                            {value === "" ? "-" : value}
                          </span>
                        ) : (
                          <Input
                            value={value}
                            onChange={(event) =>
                              setValue(key, event.target.value)
                            }
                            inputMode="decimal"
                            aria-label={`${component.name} score for ${student.name}`}
                            aria-invalid={bad || undefined}
                            className="w-20"
                          />
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 font-medium text-slate-900">
                    {row.filled === 0 ? "-" : row.total}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.percent === null ? "-" : `${row.percent}%`}
                  </td>
                  {showGrades ? (
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {grade?.grade ?? "-"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {!readOnly ? (
        confirming ? (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{confirmText}</p>
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => send(true)}
                disabled={saving}
              >
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
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => send(false)}
            >
              {saving ? "Saving..." : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
            >
              Submit results
            </Button>
            <span className="text-xs text-slate-500">
              {missing === 0
                ? "All scores entered."
                : `${missing} score${missing === 1 ? "" : "s"} still empty.`}
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}
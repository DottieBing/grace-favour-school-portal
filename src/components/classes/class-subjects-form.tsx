"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export type SubjectOption = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type OtherClass = {
  id: string;
  name: string;
  subjectIds: string[];
};

const selectClass =
  "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500";

export function ClassSubjectsForm({
  classId,
  subjects,
  selected,
  otherClasses,
}: {
  classId: string;
  subjects: SubjectOption[];
  selected: string[];
  otherClasses: OtherClass[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initial = new Set(selected);
  const dirty =
    chosen.size !== initial.size ||
    [...chosen].some((subjectId) => !initial.has(subjectId));

  function toggle(subjectId: string) {
    setSaved(false);
    setChosen((previous) => {
      const next = new Set(previous);

      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }

      return next;
    });
  }

  function copyFrom(otherId: string) {
    const source = otherClasses.find((item) => item.id === otherId);
    if (!source) return;

    const available = new Set(
      subjects
        .filter((subject) => subject.isActive || chosen.has(subject.id))
        .map((subject) => subject.id),
    );

    setSaved(false);
    setChosen(new Set(source.subjectIds.filter((item) => available.has(item))));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/admin/classes/${classId}/subjects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: [...chosen] }),
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

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No subjects yet. Add your subjects on the Subjects page first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {chosen.size} of {subjects.length} subject
          {subjects.length === 1 ? "" : "s"} selected
        </p>

        {otherClasses.length > 0 ? (
          <select
            className={selectClass}
            value=""
            onChange={(event) => copyFrom(event.target.value)}
            aria-label="Copy subjects from another class"
          >
            <option value="">Copy from another class...</option>
            {otherClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {subjects.map((subject) => {
          const checked = chosen.has(subject.id);
          const locked = !subject.isActive && !checked;

          return (
            <label
              key={subject.id}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                checked
                  ? "border-[#0D5C63] bg-[#F1F8F7]"
                  : "border-slate-200"
              } ${locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={() => toggle(subject.id)}
                className="size-4"
              />
              <span className="flex-1 text-slate-900">{subject.name}</span>
              {subject.code ? (
                <span className="font-mono text-xs text-slate-500">
                  {subject.code}
                </span>
              ) : null}
              {!subject.isActive ? (
                <span className="text-xs text-slate-500">Inactive</span>
              ) : null}
            </label>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving..." : "Save subjects"}
        </Button>
        {saved && !dirty ? (
          <span className="text-sm text-emerald-700">Saved.</span>
        ) : null}
      </div>
    </div>
  );
}
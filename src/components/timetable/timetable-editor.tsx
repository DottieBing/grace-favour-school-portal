"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DAY_NAMES, appliesOn } from "@/lib/timetable/time";
import {
  cellKey,
  type Cell,
  type PeriodInfo,
  type PersonOption,
  type SubjectOption,
} from "@/lib/timetable/types";

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export type OtherClassCells = { id: string; name: string; cells: Record<string, Cell> };

export function TimetableEditor({
  classId,
  days,
  periods,
  subjects,
  teachers,
  initial,
  others,
  readOnly,
}: {
  classId: string;
  days: number[];
  periods: PeriodInfo[];
  subjects: SubjectOption[];
  teachers: PersonOption[];
  initial: Record<string, Cell>;
  others: OtherClassCells[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [cells, setCells] = useState<Record<string, Cell>>(initial);
  const [editing, setEditing] = useState<{ periodId: string; periodName: string; day: number } | null>(null);
  const [mode, setMode] = useState<"subject" | "label">("subject");
  const [subjectId, setSubjectId] = useState("");
  const [label, setLabel] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectById = new Map(subjects.map((item) => [item.id, item]));
  const teacherName = new Map(teachers.map((item) => [item.id, item.name]));

  function open(period: PeriodInfo, day: number) {
    const cell = cells[cellKey(period.id, day)];

    setMode(cell?.subjectId ? "subject" : cell?.label ? "label" : subjects.length > 0 ? "subject" : "label");
    setSubjectId(cell?.subjectId ?? "");
    setLabel(cell?.label ?? "");
    setTeacherId(cell?.teacherId ?? "");
    setRoom(cell?.room ?? "");
    setDialogError(null);
    setEditing({ periodId: period.id, periodName: period.name, day });
  }

  function apply() {
    if (!editing) return;

    if (mode === "subject" && !subjectId) {
      setDialogError("Choose a subject, or use Clear slot.");
      return;
    }

    if (mode === "label" && label.trim() === "") {
      setDialogError("Enter a label, or use Clear slot.");
      return;
    }

    const key = cellKey(editing.periodId, editing.day);

    setSaved(false);
    setCells((previous) => ({
      ...previous,
      [key]: {
        subjectId: mode === "subject" ? subjectId : null,
        label: mode === "label" ? label.trim() : "",
        teacherId: teacherId === "" ? null : teacherId,
        room: room.trim(),
      },
    }));
    setEditing(null);
  }

  function clear() {
    if (!editing) return;

    const key = cellKey(editing.periodId, editing.day);

    setSaved(false);
    setCells((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setEditing(null);
  }

  function copyFrom(otherId: string) {
    const source = others.find((item) => item.id === otherId);

    if (!source) return;

    const next: Record<string, Cell> = {};

    for (const period of periods) {
      if (period.isBreak) continue;

      for (const day of days) {
        if (!appliesOn(period.days, day)) continue;

        const key = cellKey(period.id, day);
        const cell = source.cells[key];

        if (!cell) continue;

        if (cell.subjectId) {
          // Only subjects this class takes carry over, and the teacher is re-picked.
          if (subjectById.has(cell.subjectId)) {
            next[key] = { ...cell, teacherId: null };
          }
        } else {
          next[key] = cell;
        }
      }
    }

    setSaved(false);
    setCells(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const body = Object.entries(cells).map(([key, cell]) => {
      const [periodId, day] = key.split(":");

      return {
        periodId,
        day: Number(day),
        subjectId: cell.subjectId,
        label: cell.label,
        teacherId: cell.teacherId,
        room: cell.room,
      };
    });

    try {
      const response = await fetch(`/api/admin/timetable/classes/${classId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells: body }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

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

  function describe(cell: Cell) {
    const subject = cell.subjectId ? subjectById.get(cell.subjectId) : null;
    const title = subject?.name ?? cell.label;
    const teacher = cell.teacherId
      ? teacherName.get(cell.teacherId)
      : (subject?.teacherId ? teacherName.get(subject.teacherId) : undefined);

    return { title, teacher };
  }

  return (
    <div className="space-y-4">
      {!readOnly && others.length > 0 ? (
        <select
          className={`${selectClass} sm:w-72`}
          value=""
          onChange={(event) => copyFrom(event.target.value)}
          aria-label="Copy from another class"
        >
          <option value="">Copy from a class on the same schedule...</option>
          {others.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500">
              <th className="w-32 px-3 py-2 font-medium">Period</th>
              {days.map((day) => (
                <th key={day} className="px-3 py-2 font-medium">
                  {DAY_NAMES[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{period.name}</div>
                  <div className="font-mono text-xs text-slate-500">
                    {period.start} to {period.end}
                  </div>
                </td>

                {period.isBreak ? (
                  <td colSpan={days.length} className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                    Break
                  </td>
                ) : (
                  days.map((day) => {
                    if (!appliesOn(period.days, day)) {
                      return (
                        <td key={day} className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-300">
                          -
                        </td>
                      );
                    }

                    const cell = cells[cellKey(period.id, day)];
                    const info = cell ? describe(cell) : null;

                    const inner = info ? (
                      <>
                        <span className="block font-medium text-slate-900">{info.title}</span>
                        <span className="block text-xs text-slate-500">
                          {info.teacher ?? "No teacher"}
                          {cell?.room ? ` · ${cell.room}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{readOnly ? "-" : "Add"}</span>
                    );

                    return (
                      <td key={day} className="p-1.5">
                        {readOnly ? (
                          <div className="min-h-[3rem] rounded-md px-2 py-1.5">{inner}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => open(period, day)}
                            className={`min-h-[3rem] w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-slate-50 ${
                              info ? "border-slate-200" : "border-dashed border-slate-200"
                            }`}
                          >
                            {inner}
                          </button>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save timetable"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSaved(false);
              setCells({});
            }}
          >
            Clear everything
          </Button>
          {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        </div>
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `${DAY_NAMES[editing.day]}, ${editing.periodName}` : "Slot"}
            </DialogTitle>
            <DialogDescription>
              Pick a subject (its teacher is filled in automatically), or type a
              custom label such as Games or Assembly.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["subject", "label"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {value === "subject" ? "Subject" : "Custom label"}
              </button>
            ))}
          </div>

          {mode === "subject" ? (
            subjects.length === 0 ? (
              <p className="text-sm text-slate-500">
                This class has no subjects yet. Tick them on the class page, or use a custom label.
              </p>
            ) : (
              <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
                <option value="">Choose a subject...</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.teacherId ? ` (${teacherName.get(item.teacherId) ?? "assigned"})` : " (no teacher yet)"}
                  </option>
                ))}
              </select>
            )
          ) : (
            <Input placeholder="e.g. Games" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Label" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="slot-teacher" className="text-sm font-medium">Teacher</label>
              <select id="slot-teacher" className={selectClass} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">
                  {mode === "subject" ? "Automatic (assigned teacher)" : "No teacher"}
                </option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="slot-room" className="text-sm font-medium">Room (optional)</label>
              <Input id="slot-room" maxLength={40} value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
          </div>

          {dialogError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dialogError}</div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={clear}>
              Clear slot
            </Button>
            <Button type="button" onClick={apply}>
              Set slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
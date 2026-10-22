"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BandData = {
  grade: string;
  minPercent: number;
  remark: string;
  points: number | null;
};

type Row = { grade: string; minPercent: string; remark: string; points: string };

const EXAMPLE: Row[] = [
  { grade: "A", minPercent: "70", remark: "Excellent", points: "" },
  { grade: "B", minPercent: "60", remark: "Very good", points: "" },
  { grade: "C", minPercent: "50", remark: "Good", points: "" },
  { grade: "D", minPercent: "45", remark: "Fair", points: "" },
  { grade: "E", minPercent: "40", remark: "Pass", points: "" },
  { grade: "F", minPercent: "0", remark: "Fail", points: "" },
];

function toRows(bands: BandData[]): Row[] {
  return bands.map((band) => ({
    grade: band.grade,
    minPercent: String(band.minPercent),
    remark: band.remark,
    points: band.points === null ? "" : String(band.points),
  }));
}

export function BandsEditor({ initial }: { initial: BandData[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(toRows(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<Row>) {
    setSaved(false);
    setRows((previous) =>
      previous.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function remove(index: number) {
    setSaved(false);
    setRows((previous) => previous.filter((_, position) => position !== index));
  }

  function add() {
    setSaved(false);
    setRows((previous) => [
      ...previous,
      { grade: "", minPercent: "", remark: "", points: "" },
    ]);
  }

  // Shows what each band covers, from the highest down.
  const ranges = (() => {
    const valid = rows
      .map((row, index) => ({ index, min: Number(row.minPercent), blank: row.minPercent.trim() === "" }))
      .filter((item) => !item.blank && Number.isFinite(item.min))
      .sort((a, b) => b.min - a.min);

    const result = new Map<number, string>();

    valid.forEach((item, position) => {
      const above = valid[position - 1];
      result.set(
        item.index,
        above ? `${item.min}% to below ${above.min}%` : `${item.min}% and above`,
      );
    });

    return result;
  })();

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const bands = [];

    for (const row of rows) {
      const minPercent = Number(row.minPercent);
      const points = row.points.trim() === "" ? null : Number(row.points);

      if (row.minPercent.trim() === "" || !Number.isFinite(minPercent)) {
        setError("Every band needs a starting percentage.");
        setSaving(false);
        return;
      }

      if (points !== null && !Number.isFinite(points)) {
        setError("Points must be a number or left blank.");
        setSaving(false);
        return;
      }

      bands.push({
        grade: row.grade,
        minPercent,
        remark: row.remark,
        points,
      });
    }

    try {
      const response = await fetch("/api/admin/grading/bands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bands }),
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
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No grade scale yet. Add bands, or load an example to start from.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[5rem_6rem_1fr_5rem_2.5rem] gap-2 px-1 text-xs text-slate-500 sm:grid">
            <span>Grade</span>
            <span>Starts at %</span>
            <span>Remark</span>
            <span>Points</span>
            <span />
          </div>

          {rows.map((row, index) => (
            <div key={index} className="space-y-1">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[5rem_6rem_1fr_5rem_2.5rem]">
                <Input
                  value={row.grade}
                  onChange={(event) => update(index, { grade: event.target.value })}
                  placeholder="A"
                  maxLength={10}
                  aria-label="Grade"
                />
                <Input
                  value={row.minPercent}
                  onChange={(event) => update(index, { minPercent: event.target.value })}
                  placeholder="70"
                  inputMode="decimal"
                  aria-label="Starts at percent"
                />
                <Input
                  value={row.remark}
                  onChange={(event) => update(index, { remark: event.target.value })}
                  placeholder="Remark (optional)"
                  maxLength={40}
                  aria-label="Remark"
                  className="col-span-2 sm:col-span-1"
                />
                <Input
                  value={row.points}
                  onChange={(event) => update(index, { points: event.target.value })}
                  placeholder="Pts"
                  inputMode="decimal"
                  aria-label="Grade points"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove band"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {ranges.get(index) ? (
                <p className="px-1 text-xs text-slate-500">{ranges.get(index)}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || rows.length === 0}>
          {saving ? "Saving..." : "Save grade scale"}
        </Button>
        <Button type="button" variant="outline" onClick={add} className="gap-2">
          <Plus className="size-4" />
          Add band
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSaved(false);
            setRows(EXAMPLE);
          }}
        >
          Load example
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>
    </div>
  );
}
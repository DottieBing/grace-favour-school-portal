"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Candidate = {
  id: string;
  name: string;
  admissionNumber: string;
  fromClass: string | null;
};

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function ClassStudents({
  classId,
  className,
  capacity,
  memberCount,
  candidates,
}: {
  classId: string;
  className: string;
  capacity: number | null;
  memberCount: number;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const classes = useMemo(
    () => [...new Set(candidates.map((item) => item.fromClass).filter((item): item is string => Boolean(item)))].sort(),
    [candidates],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();

    return candidates.filter((item) => {
      if (from === "none" && item.fromClass) return false;
      if (from !== "all" && from !== "none" && item.fromClass !== from) return false;

      return q === "" || item.name.toLowerCase().includes(q) || item.admissionNumber.toLowerCase().includes(q);
    });
  }, [candidates, query, from]);

  const allShown = shown.length > 0 && shown.every((item) => selected.has(item.id));
  const after = memberCount + selected.size;
  const over = capacity !== null && after > capacity;

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function toggleAll() {
    setSelected((previous) => {
      const next = new Set(previous);

      if (allShown) shown.forEach((item) => next.delete(item.id));
      else shown.forEach((item) => next.add(item.id));

      return next;
    });
  }

  async function move() {
    setConfirming(false);
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected] }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        moved?: number;
        overCapacity?: boolean;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSelected(new Set());
      setMessage(
        `${data.moved ?? 0} student${data.moved === 1 ? "" : "s"} moved to ${className}.${
          data.overCapacity ? " The class is now over its capacity." : ""
        }`,
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (candidates.length === 0) {
    return <p className="text-sm text-slate-500">Every active student is already in this class.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or admission number"
            className="pl-9"
          />
        </div>
        <select value={from} onChange={(event) => setFrom(event.target.value)} className={selectClass} aria-label="Currently in">
          <option value="all">From any class</option>
          <option value="none">No class yet</option>
          {classes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        <label className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" className="size-4" checked={allShown} onChange={toggleAll} />
          Select all {shown.length} shown
        </label>
        {shown.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No students match.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" className="size-4" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-900">{item.name}</span>
                    <span className="font-mono text-xs text-slate-500">{item.admissionNumber}</span>
                  </span>
                  <span className="text-xs text-slate-500">{item.fromClass ?? "No class"}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {over ? (
        <p className="text-sm text-amber-700">
          That would make {after} students, over the capacity of {capacity}. You can still go ahead.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {confirming ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            Move {selected.size} student{selected.size === 1 ? "" : "s"} to {className}? Their past results and
            attendance stay with the class they were recorded in.
          </p>
          <div className="flex gap-3">
            <Button type="button" onClick={move} disabled={saving}>
              Yes, move
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" disabled={selected.size === 0 || saving} onClick={() => setConfirming(true)}>
          {saving ? "Moving..." : `Move ${selected.size} to ${className}`}
        </Button>
      )}
    </div>
  );
}
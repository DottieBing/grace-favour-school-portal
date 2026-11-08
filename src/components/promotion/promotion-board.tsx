"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PromotionRow = {
  id: string;
  name: string;
  admissionNumber: string;
  average: number | null;
  position: number | null;
};

type Choice = "move" | "stay";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function PromotionBoard({
  classId,
  className,
  students,
  destinations,
  isFinal,
  standingLabel,
  outOf,
}: {
  classId: string;
  className: string;
  students: PromotionRow[];
  destinations: { id: string; name: string }[];
  isFinal: boolean;
  standingLabel: string | null;
  outOf: number;
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, Choice>>(
    Object.fromEntries(students.map((item) => [item.id, "move" as Choice])),
  );
  const [destination, setDestination] = useState(destinations.length === 1 ? destinations[0].id : "");
  const [passMark, setPassMark] = useState("40");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    promoted: number;
    stayed: number;
    graduated: number;
    failed: number;
  } | null>(null);

  const moving = students.filter((item) => choices[item.id] === "move").length;
  const staying = students.length - moving;
  const moveWord = isFinal ? "Graduate" : "Move up";

  function setAll(choice: Choice) {
    setChoices(Object.fromEntries(students.map((item) => [item.id, choice])));
  }

  function suggest() {
    const mark = Number(passMark);

    if (!Number.isFinite(mark)) {
      setError("Enter the pass mark as a number.");
      return;
    }

    setError(null);
    setChoices(
      Object.fromEntries(
        students.map((item) => [
          item.id,
          item.average !== null && item.average < mark ? ("stay" as Choice) : ("move" as Choice),
        ]),
      ),
    );
  }

  function review() {
    setError(null);

    if (!isFinal && moving > 0 && !destination) {
      setError("Choose the class they move up to.");
      return;
    }

    setConfirming(true);
  }

  async function run() {
    setConfirming(false);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          destinationClassId: isFinal || moving === 0 ? null : destination,
          decisions: students.map((item) => ({
            studentId: item.id,
            action: choices[item.id] === "move" ? (isFinal ? "graduate" : "promote") : "repeat",
          })),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        promoted?: number;
        stayed?: number;
        graduated?: number;
        failed?: number;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult({
        promoted: data.promoted ?? 0,
        stayed: data.stayed ?? 0,
        graduated: data.graduated ?? 0,
        failed: data.failed ?? 0,
      });
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Promotion finished for {className}</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            [isFinal ? "Graduated" : "Moved up", isFinal ? result.graduated : result.promoted, "bg-emerald-50 text-emerald-700"],
            ["Stayed", result.stayed, "bg-slate-100 text-slate-700"],
            ["Failed", result.failed, "bg-red-50 text-red-700"],
          ].map(([label, value, style]) => (
            <div key={label as string} className={`rounded-lg p-3 ${style}`}>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-xs">{label}</div>
            </div>
          ))}
        </div>
        {result.failed > 0 ? (
          <p className="text-sm text-red-700">
            Some students could not be updated. They are still in {className}. Open the class and try again.
          </p>
        ) : null}
        <Link
          href="/admin/promotion"
          className="inline-flex h-8 items-center rounded-md bg-[#0D5C63] px-3 text-sm font-medium text-white hover:bg-[#09494F]"
        >
          Back to promotion
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          {standingLabel
            ? `Averages and positions are from ${standingLabel} (published subjects only, ${outOf} students ranked).`
            : "No published results for this class yet, so there are no averages to suggest from."}{" "}
          You decide who {isFinal ? "graduates" : "moves up"}.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          {!isFinal ? (
            <div className="space-y-1.5">
              <label htmlFor="dest" className="text-sm font-medium">
                Move up to
              </label>
              {destinations.length === 0 ? (
                <p className="text-sm text-amber-700">
                  There is no active class one level up. Add it on the Classes page first.
                </p>
              ) : (
                <select id="dest" className={selectClass} value={destination} onChange={(event) => setDestination(event.target.value)}>
                  <option value="">Choose a class...</option>
                  {destinations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="pass" className="text-sm font-medium">
              Pass mark (%)
            </label>
            <div className="flex gap-2">
              <Input id="pass" inputMode="decimal" value={passMark} onChange={(event) => setPassMark(event.target.value)} className="w-20" />
              <Button type="button" variant="outline" onClick={suggest} disabled={!standingLabel}>
                Suggest from pass mark
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setAll("move")}>
              Everyone: {moveWord.toLowerCase()}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAll("stay")}>
              Everyone: stays
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {students.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">There are no active students in this class.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {students.map((item) => {
              const choice = choices[item.id];

              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="font-mono text-xs text-slate-500">{item.admissionNumber}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {item.average !== null ? (
                      <>
                        <span className="font-medium text-slate-900">{item.average}%</span>
                        {item.position ? ` · position ${item.position}` : ""}
                      </>
                    ) : (
                      "No results"
                    )}
                  </div>
                  <div className="flex gap-1" role="group" aria-label={`Decision for ${item.name}`}>
                    {(["move", "stay"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={choice === value}
                        onClick={() => setChoices((previous) => ({ ...previous, [item.id]: value }))}
                        className={`h-8 rounded-full px-3.5 text-xs font-medium transition-colors ${
                          choice === value
                            ? value === "move"
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-700 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {value === "move" ? moveWord : "Stays"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {confirming ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            {moving} {isFinal ? "will graduate" : "will move up"}
            {!isFinal && moving > 0
              ? ` to ${destinations.find((item) => item.id === destination)?.name ?? "the chosen class"}`
              : ""}
            , and {staying} will stay in {className}.
            {isFinal && moving > 0
              ? " Graduated students can no longer sign in. You can reactivate any of them later."
              : ""}
          </p>
          <div className="flex gap-3">
            <Button type="button" onClick={run} disabled={saving}>
              {saving ? "Working..." : "Yes, apply"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={review}
          disabled={saving || students.length === 0 || (!isFinal && destinations.length === 0 && moving > 0)}
          className="gap-2"
        >
          {isFinal ? <GraduationCap className="size-4" /> : <TrendingUp className="size-4" />}
          Review and apply ({moving} {isFinal ? "graduate" : "move up"}, {staying} stay)
        </Button>
      )}
    </div>
  );
}
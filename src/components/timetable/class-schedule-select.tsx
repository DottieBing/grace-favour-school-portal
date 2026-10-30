"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60";

export function ClassScheduleSelect({
  classId,
  className,
  value,
  schedules,
  hasEntries,
  disabled,
}: {
  classId: string;
  className: string;
  value: string;
  schedules: { id: string; name: string }[];
  hasEntries: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (
      hasEntries &&
      !window.confirm(
        `Changing ${className}'s schedule clears its timetable, because the periods differ. Continue?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/timetable/classes/${classId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: next === "" ? null : next }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={selectClass}
        value={value}
        disabled={disabled || busy}
        onChange={(event) => change(event.target.value)}
        aria-label={`Schedule for ${className}`}
      >
        <option value="">Default schedule</option>
        {schedules.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
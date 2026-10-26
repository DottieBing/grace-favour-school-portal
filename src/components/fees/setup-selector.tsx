"use client";

import { useRouter } from "next/navigation";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export function SetupSelector({
  classes,
  terms,
  classId,
  termId,
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; label: string }[];
  classId: string;
  termId: string;
}) {
  const router = useRouter();

  function go(nextClass: string, nextTerm: string) {
    router.push(`/admin/fees/setup?classId=${nextClass}&termId=${nextTerm}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className={selectClass}
        value={classId}
        onChange={(event) => go(event.target.value, termId)}
        aria-label="Class"
      >
        {classes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={termId}
        onChange={(event) => go(classId, event.target.value)}
        aria-label="Term"
      >
        {terms.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
"use client";

import { useRouter } from "next/navigation";

export function DatePicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      value={value}
      max={max}
      aria-label="Attendance date"
      onChange={(event) => {
        if (event.target.value) {
          router.push(`/admin/attendance?date=${event.target.value}`);
        }
      }}
      className="h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
    />
  );
}
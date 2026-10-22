"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { TableRow } from "@/components/ui/table";

const INTERACTIVE =
  "a, button, input, select, textarea, label, [role='button'], [role='checkbox']";

export function ClickableRow({
  href,
  className = "",
  ...props
}: Omit<ComponentProps<typeof TableRow>, "onClick"> & { href: string | null }) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (!href) return;

    const target = event.target as HTMLElement;

    // Clicks inside a dialog opened from this row aren't clicks on the row.
    if (!event.currentTarget.contains(target)) return;
    if (target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;

    router.push(href);
  }

  return (
    <TableRow
      {...props}
      onClick={handleClick}
      className={`${href ? "cursor-pointer" : ""} ${className}`}
    />
  );
}
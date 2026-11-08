"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
} from "lucide-react";

import { AppShell, type NavItem } from "@/components/kit/app-shell";

const ITEMS: NavItem[] = [
  { href: "/teacher", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/teacher/results", label: "Results", icon: FileCheck2 },
  { href: "/teacher/timetable", label: "Timetable", icon: CalendarDays },
];

export function TeacherShell({
  schoolName,
  name,
  photoUrl,
  term,
  children,
}: {
  schoolName: string;
  name: string;
  photoUrl: string | null;
  term: { sessionName: string; termName: string } | null;
  children: ReactNode;
}) {
  return (
    <AppShell
      schoolName={schoolName}
      name={name}
      roleLabel="Teacher"
      photoUrl={photoUrl}
      term={term}
      items={ITEMS}
    >
      {children}
    </AppShell>
  );
}
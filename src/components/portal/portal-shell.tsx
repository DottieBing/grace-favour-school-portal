"use client";

import type { ReactNode } from "react";
import { FileCheck2, LayoutDashboard, UserRound, Wallet } from "lucide-react";

import { AppShell, type NavItem } from "@/components/kit/app-shell";

const ITEMS: NavItem[] = [
  { href: "/portal", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/portal/results", label: "Results", icon: FileCheck2 },
  { href: "/portal/fees", label: "Fees", icon: Wallet },
  { href: "/portal/account", label: "Account", icon: UserRound },
];

export function PortalShell({
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
      roleLabel="Student"
      photoUrl={photoUrl}
      term={term}
      items={ITEMS}
    >
      {children}
    </AppShell>
  );
}
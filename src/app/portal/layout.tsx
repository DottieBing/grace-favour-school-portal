import { Suspense, type ReactNode } from "react";

import { getCurrentTerm } from "@/lib/academic/current-term";
import { requireStudent } from "@/lib/portal/student";
import { PortalShell } from "@/components/portal/portal-shell";

async function ShellGate({ children }: { children: ReactNode }) {
  const [student, term] = await Promise.all([
    requireStudent(),
    getCurrentTerm(),
  ]);

  return (
    <PortalShell name={student.name} className={student.className} term={term}>
      {children}
    </PortalShell>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F8F5]" />}>
      <ShellGate>{children}</ShellGate>
    </Suspense>
  );
}
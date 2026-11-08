import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { getCurrentTerm } from "@/lib/academic/current-term";
import { requireStudent } from "@/lib/portal/student";
import { PortalShell } from "@/components/portal/portal-shell";
import { getSchoolProfile } from "@/lib/settings/school";

async function ShellGate({ children }: { children: ReactNode }) {
  await connection();

  const [student, term, school] = await Promise.all([requireStudent(), getCurrentTerm(), getSchoolProfile()]);

  return (
    <PortalShell
      schoolName={school.name}
      name={student.name}
      photoUrl={student.photoUrl}
      term={term}
    >
      {children}
    </PortalShell>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7F5]" />}>
      <ShellGate>{children}</ShellGate>
    </Suspense>
  );
}
import { Suspense, type ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { AdminShell } from "@/components/admin/admin-shell";

async function ShellGate({ children }: { children: ReactNode }) {
  const { user } = await requirePageAccess("super_admin");
  const term = await getCurrentTerm();

  return (
    <AdminShell email={user.email ?? ""} term={term}>
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F8F5]" />}>
      <ShellGate>{children}</ShellGate>
    </Suspense>
  );
}
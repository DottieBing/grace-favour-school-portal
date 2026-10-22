import { Suspense, type ReactNode } from "react";

import { requireAdminSession } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";

async function ShellGate({ children }: { children: ReactNode }) {
  const { user, isOwner, permissions } = await requireAdminSession();
  const term = await getCurrentTerm();

  let roleLabel = "Super Admin";

  if (!isOwner) {
    const admin = createAdminClient();

    const { data } = await admin
      .from("admin_users")
      .select("job_title")
      .eq("user_id", user.id)
      .maybeSingle();

    roleLabel = (data?.job_title as string | null | undefined) ?? "Staff user";
  }

  return (
    <AdminShell
      email={user.email ?? ""}
      roleLabel={roleLabel}
      isOwner={isOwner}
      permissions={permissions}
      term={term}
    >
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
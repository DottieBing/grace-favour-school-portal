import { Suspense, type ReactNode } from "react";

import { requireAdminSession } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { connection } from "next/server";
import { getSchoolProfile } from "@/lib/settings/school";
import { BrandLoader } from "@/components/kit/brand-loader";

async function ShellGate({ children }: { children: ReactNode }) {
  await connection();
  const { user, isOwner, permissions } = await requireAdminSession();
  const term = await getCurrentTerm();
  const school = await getSchoolProfile();

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
      schoolName={school.name}
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
    <Suspense fallback={<BrandLoader />}>
      <ShellGate>{children}</ShellGate>
    </Suspense>
  );
}
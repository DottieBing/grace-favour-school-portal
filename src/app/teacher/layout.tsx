import { Suspense, type ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeacherShell } from "@/components/teacher/teacher-shell";

async function ShellGate({ children }: { children: ReactNode }) {
  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();

  const [staffResult, term] = await Promise.all([
    admin
      .from("staff")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    getCurrentTerm(),
  ]);

  const name =
    (staffResult.data?.full_name as string | null | undefined) ??
    user.email ??
    "Teacher";

  return (
    <TeacherShell name={name} term={term}>
      {children}
    </TeacherShell>
  );
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F8F5]" />}>
      <ShellGate>{children}</ShellGate>
    </Suspense>
  );
}
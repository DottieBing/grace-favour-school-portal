import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { loadTeacherProfile } from "@/lib/teacher/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { getSchoolProfile } from "@/lib/settings/school";
import { BrandLoader } from "@/components/kit/brand-loader";

async function ShellGate({ children }: { children: ReactNode }) {
  await connection();

  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();

  const [profile, term, school] = await Promise.all([
    loadTeacherProfile(admin, user.id),
    getCurrentTerm(),
    getSchoolProfile(),
  ]);

  return (
    <TeacherShell
      schoolName={school.name}
      name={profile?.name ?? user.email ?? "Teacher"}
      photoUrl={profile?.photoUrl ?? null}
      term={term}
    >
      {children}
    </TeacherShell>
  );
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<BrandLoader />}>
      <ShellGate>{children}</ShellGate>
    </Suspense>
  );
}
import { Suspense } from "react";
import { connection } from "next/server";

import { requireStudent } from "@/lib/portal/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/kit/avatar";
import { Card } from "@/components/kit/card";
import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { ContactEmailForm } from "@/components/portal/contact-email-form";

type Guardian = { email: string | null; email_verified_at: string | null };

type Raw = {
  is_primary: boolean;
  guardians: Guardian | Guardian[] | null;
};

async function AccountContent() {
  await connection();

  const student = await requireStudent();

  const { data, error } = await createAdminClient()
    .from("student_guardians")
    .select("is_primary, guardians(email, email_verified_at)")
    .eq("student_id", student.id);

  if (error) console.error("Unable to load the guardian:", error.message);

  const links = (data ?? []) as unknown as Raw[];
  const link = links.find((item) => item.is_primary) ?? links[0];
  const guardian = link ? (Array.isArray(link.guardians) ? link.guardians[0] : link.guardians) : null;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Card className="flex items-center gap-4">
        <Avatar name={student.name} photoUrl={student.photoUrl} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900">{student.name}</h1>
          <p className="text-sm text-slate-500">{student.className ?? "No class yet"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Username <span className="font-mono font-medium text-slate-900">{student.admissionNumber}</span>
          </p>
        </div>
      </Card>

      <Card delay={80}>
        <h2 className="mb-3 font-semibold text-slate-900">Contact email</h2>
        <ContactEmailForm
          initialEmail={guardian?.email ?? ""}
          verified={Boolean(guardian?.email_verified_at)}
          hasGuardian={Boolean(link)}
        />
      </Card>

      <Card delay={140} className="max-w-md">
        <h2 className="mb-3 font-semibold text-slate-900">Change password</h2>
        <ChangePasswordForm admissionNumber={student.admissionNumber} />
      </Card>
    </div>
  );
}

export default function PortalAccountPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-[#E3EAE6]" />}>
      <AccountContent />
    </Suspense>
  );
}
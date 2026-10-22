import { Suspense } from "react";

import { requireStudent } from "@/lib/portal/student";
import { ChangePasswordForm } from "@/components/portal/change-password-form";

async function AccountContent() {
  const student = await requireStudent();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
        <p className="text-sm text-slate-500">
          Username: <span className="font-mono">{student.admissionNumber}</span>
        </p>
      </div>

      <section className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
        <ChangePasswordForm admissionNumber={student.admissionNumber} />
      </section>
    </div>
  );
}

export default function PortalAccountPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <AccountContent />
    </Suspense>
  );
}
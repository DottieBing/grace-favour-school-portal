import { Suspense } from "react";

import { requireAdminSession } from "@/lib/auth/access";
import { AREAS } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { NameForm, PasswordForm } from "@/components/admin/account-forms";

async function AccountContent() {
  const { user, isOwner, permissions } = await requireAdminSession();
  const admin = createAdminClient();

  const [profileResult, titleResult] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    isOwner
      ? Promise.resolve({ data: null, error: null })
      : admin.from("admin_users").select("job_title").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profileResult.error || titleResult.error) {
    console.error(
      "Unable to load the account:",
      profileResult.error?.message ?? titleResult.error?.message,
    );

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load your account. Please refresh the page.
        </div>
      </div>
    );
  }

  const name = (profileResult.data?.full_name as string | undefined) ?? "";
  const email = user.email ?? "";
  const title = isOwner
    ? "Super Admin"
    : ((titleResult.data as { job_title: string | null } | null)?.job_title ?? "Staff user");

  const access = AREAS.filter((area) => permissions[area.key]).map(
    (area) => `${area.label} (${permissions[area.key]})`,
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My account</h1>
        <p className="text-sm text-slate-500">Your sign-in details and what you can open.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">Email (your username)</div>
            <div className="mt-0.5 break-all text-sm text-slate-900">{email}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Role</div>
            <div className="mt-0.5 text-sm text-slate-900">{title}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Access</div>
            <div className="mt-0.5 text-sm text-slate-900">
              {isOwner ? "Everything" : access.length > 0 ? access.join(", ") : "None"}
            </div>
          </div>
        </div>
        {!isOwner ? (
          <p className="mt-4 text-xs text-slate-500">
            Your email, role and access are set by the school owner. Ask them if something needs to change.
          </p>
        ) : null}
      </section>

      <section className="max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Your name</h2>
        <NameForm initialName={name} />
      </section>

      <section className="max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Change password</h2>
        <PasswordForm email={email} />
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <AccountContent />
    </Suspense>
  );
}
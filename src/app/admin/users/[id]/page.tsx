import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requirePageAccess } from "@/lib/auth/access";
import { cleanPermissions } from "@/lib/users/clean";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmStatusButton } from "@/components/admin/confirm-status-button";
import { EditAccessForm } from "@/components/users/edit-access-form";
import { ResetUserPasswordButton } from "@/components/users/reset-user-password-button";

async function UserContent({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("super_admin");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [adminUserResult, profileResult, permissionsResult, templatesResult] =
    await Promise.all([
      admin.from("admin_users").select("user_id, job_title").eq("user_id", id).maybeSingle(),
      admin.from("profiles").select("full_name, email, is_active").eq("id", id).maybeSingle(),
      admin.from("admin_permissions").select("area, level").eq("user_id", id),
      admin
        .from("permission_templates")
        .select("id, name, permissions")
        .order("name", { ascending: true }),
    ]);

  const failed =
    adminUserResult.error ??
    profileResult.error ??
    permissionsResult.error ??
    templatesResult.error;

  if (failed) {
    console.error("Unable to load user:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this user. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!adminUserResult.data || !profileResult.data) {
    notFound();
  }

  const profile = profileResult.data;
  const name = profile.full_name as string;
  const email = (profile.email as string | null) ?? "";
  const active = profile.is_active as boolean;

  const ticks = cleanPermissions(
    Object.fromEntries(
      (permissionsResult.data ?? []).map((row) => [row.area as string, row.level as string]),
    ),
  );

  const templates = (templatesResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    permissions: cleanPermissions(item.permissions),
  }));

  const { data: authData } = await admin.auth.admin.getUserById(id);
  const lastSignIn = authData.user?.last_sign_in_at ?? null;

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to users
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
          <span
            className={
              active
                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
            }
          >
            {active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{email}</p>
        <p className="mt-1 text-xs text-slate-500">
          Last sign-in:{" "}
          {lastSignIn ? new Date(lastSignIn).toLocaleString("en-GB") : "Never signed in"}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Access</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Tick what this person can open. Changes apply the next time they load a page.
        </p>
        <EditAccessForm
          userId={id}
          initialTitle={(adminUserResult.data.job_title as string | null) ?? ""}
          initialPermissions={ticks}
          templates={templates}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Login</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          They sign in with their email and password on the normal login page.
        </p>
        <ResetUserPasswordButton userId={id} name={name} email={email} disabled={!active} />
        {!active ? (
          <p className="mt-2 text-sm text-slate-500">Reactivate the user to reset their password.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mt-2 mb-4 text-sm text-slate-600">
          {active
            ? "Deactivating blocks their login straight away. Nothing they did is lost, and you can reactivate them anytime."
            : "This user is inactive. Reactivating lets them sign in again."}
        </p>
        <ConfirmStatusButton
          url={`/api/admin/users/${id}/status`}
          name={name}
          isActive={active}
          deactivateMessage="They won't be able to sign in. You can reactivate them anytime."
          reactivateMessage="They'll be able to sign in again with their current password."
        />
      </section>
    </div>
  );
}

function UserFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<UserFallback />}>
      <UserContent params={params} />
    </Suspense>
  );
}
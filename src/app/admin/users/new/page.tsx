import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requirePageAccess } from "@/lib/auth/access";
import { cleanPermissions } from "@/lib/users/clean";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddUserForm } from "@/components/users/add-user-form";

async function NewUserContent() {
  await requirePageAccess("super_admin");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("permission_templates")
    .select("id, name, permissions")
    .order("name", { ascending: true });

  if (error) {
    console.error("Unable to load templates:", error.message);
  }

  const templates = (data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    permissions: cleanPermissions(item.permissions),
  }));

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to users
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Add user</h1>
        <p className="text-sm text-slate-500">
          Give someone a login and tick what they can open. Leave unticked
          whatever they shouldn&apos;t see.
        </p>
      </div>

      <AddUserForm templates={templates} />
    </div>
  );
}

function NewUserFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-96 max-w-2xl animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function NewUserPage() {
  return (
    <Suspense fallback={<NewUserFallback />}>
      <NewUserContent />
    </Suspense>
  );
}
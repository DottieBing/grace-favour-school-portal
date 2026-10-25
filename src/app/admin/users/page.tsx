import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePageAccess } from "@/lib/auth/access";
import { cleanPermissions, summarize } from "@/lib/users/clean";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClickableRow } from "@/components/admin/clickable-row";
import { DeleteTemplateButton } from "@/components/users/delete-template-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Profile = { full_name: string; email: string | null; is_active: boolean };

type Raw = {
  user_id: string;
  job_title: string | null;
  profiles: Profile | Profile[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function UsersContent() {
  await requirePageAccess("super_admin");

  const admin = createAdminClient();

  const [usersResult, permissionsResult, templatesResult] = await Promise.all([
    admin
      .from("admin_users")
      .select("user_id, job_title, profiles(full_name, email, is_active)")
      .order("created_at", { ascending: false }),
    admin.from("admin_permissions").select("user_id, area, level"),
    admin
      .from("permission_templates")
      .select("id, name, permissions")
      .order("name", { ascending: true }),
  ]);

  const failed = usersResult.error ?? permissionsResult.error ?? templatesResult.error;

  if (failed) {
    console.error("Unable to load users:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the users. Please refresh the page.
        </div>
      </div>
    );
  }

  const ticksByUser = new Map<string, Record<string, string>>();

  for (const row of permissionsResult.data ?? []) {
    const entry = ticksByUser.get(row.user_id as string) ?? {};
    entry[row.area as string] = row.level as string;
    ticksByUser.set(row.user_id as string, entry);
  }

  const users = (usersResult.data ?? []) as unknown as Raw[];

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users &amp; Access</h1>
          <p className="text-sm text-slate-500">
            People you&apos;ve given a login, and exactly what each can open.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex h-8 items-center gap-2 rounded-md bg-[#0D5C63] px-3 text-sm font-medium text-white hover:bg-[#09494F]"
        >
          <Plus className="size-4" />
          Add user
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">
                  No users yet. Use &quot;Add user&quot; to give someone a login.
                </TableCell>
              </TableRow>
            ) : (
              users.map((item) => {
                const profile = first(item.profiles);
                const ticks = cleanPermissions(ticksByUser.get(item.user_id) ?? {});

                return (
                  <ClickableRow key={item.user_id} href={`/admin/users/${item.user_id}`}>
                    <TableCell>
                      <Link
                        href={`/admin/users/${item.user_id}`}
                        className="font-medium text-slate-900 hover:text-[#0D5C63] hover:underline"
                      >
                        {profile?.full_name ?? "Unnamed"}
                      </Link>
                      <div className="text-xs text-slate-500">{profile?.email ?? ""}</div>
                    </TableCell>
                    <TableCell>{item.job_title ?? "-"}</TableCell>
                    <TableCell className="max-w-sm text-xs text-slate-600">
                      {summarize(ticks)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          profile?.is_active
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        }
                      >
                        {profile?.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </ClickableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Saved templates</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tick-patterns you can pick when adding a user. A template only
            pre-fills the ticks, and changing or deleting it never affects
            existing users.
          </p>
        </div>

        {(templatesResult.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">
            None yet. Tick &quot;Save these ticks as a template&quot; when adding a user.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(templatesResult.data ?? []).map((item) => (
              <li
                key={item.id as string}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.name as string}</p>
                  <p className="text-xs text-slate-500">
                    {summarize(cleanPermissions(item.permissions))}
                  </p>
                </div>
                <DeleteTemplateButton id={item.id as string} name={item.name as string} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UsersFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersFallback />}>
      <UsersContent />
    </Suspense>
  );
}
import { Suspense } from "react";
import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateStaffSheet } from "@/components/staff/create-staff-sheet";
import { StaffTable, type StaffRow } from "@/components/staff/staff-table";

async function StaffContent() {
    // 1. Only an active, signed-in Super Admin may view this page.
  const { canManage } = await requireAreaAccess("staff")

  // 2. Permission verified, so read staff with the server-only admin client.
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("staff")
    .select(
      "id, user_id, full_name, email, phone, staff_number, job_title, department, staff_type, is_active, employment_date",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load staff:", error.message);
  }

  const staff = (data ?? []) as StaffRow[];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
          <p className="text-sm text-slate-500">
            Manage teaching and non-teaching staff records.
          </p>
        </div>
        {canManage ? <CreateStaffSheet /> : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the staff list. Please refresh the page.
        </div>
      ) : (
        <StaffTable staff={staff} />
      )}
    </div>
  );
}

function StaffFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<StaffFallback />}>
      <StaffContent />
    </Suspense>
  );
}
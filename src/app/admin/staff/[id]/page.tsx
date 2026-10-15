import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditStaffSheet } from "@/components/staff/edit-staff-sheet";
import {
  ResetPasswordButton,
  StatusButton,
} from "@/components/staff/staff-profile-actions";
import { StaffPhoto } from "@/components/staff/staff-photo";

type StaffProfile = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  staff_number: string;
  job_title: string | null;
  department: string | null;
  staff_type: "teaching" | "non_teaching";
  is_active: boolean;
  employment_date: string | null;
  gender: "male" | "female" | null;
  date_of_birth: string | null;
  address: string | null;
  qualification: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_path: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value || "Not set"}</div>
    </div>
  );
}

async function ProfileContent({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageAccess("super_admin");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("staff")
    .select(
      "id, user_id, full_name, email, phone, staff_number, job_title, department, staff_type, is_active, employment_date, gender, date_of_birth, address, qualification, emergency_contact_name, emergency_contact_phone, photo_path",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Unable to load staff profile:", error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this profile. Please refresh the page.
        </div>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const staff = data as StaffProfile;
  const name = staff.full_name ?? staff.staff_number;

  // Signed link that expires after an hour. The bucket itself stays private.
  let photoUrl: string | null = null;

  if (staff.photo_path) {
    const { data: signed } = await admin.storage
      .from("staff-photos")
      .createSignedUrl(staff.photo_path, 3600);

    photoUrl = signed?.signedUrl ?? null;
  }

  // Work out whether sensitive actions are allowed on this account.
  let protectedReason: string | null = null;

  if (staff.user_id) {
    if (staff.user_id === user.id) {
      protectedReason = "This is your own account, so it can't be changed here.";
    } else {
      const { data: targetRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", staff.user_id);

      if (targetRoles?.some((item) => item.role === "super_admin")) {
        protectedReason =
          "Super Admin accounts can't be changed from this screen.";
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to staff
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start gap-6">
          <StaffPhoto staffId={staff.id} name={name} photoUrl={photoUrl} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
              <span
                className={
                  staff.is_active
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                }
              >
                {staff.is_active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {staff.staff_type === "teaching" ? "Teaching" : "Non-teaching"}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-600">
              {staff.job_title ?? "No job title"}
              {staff.department ? ` · ${staff.department}` : ""}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {staff.staff_number}
            </p>
          </div>

          <EditStaffSheet
            staff={{
              id: staff.id,
              hasLogin: Boolean(staff.user_id),
              fullName: staff.full_name ?? "",
              jobTitle: staff.job_title ?? "",
              department: staff.department ?? "",
              phone: staff.phone ?? "",
              email: staff.email ?? "",
              employmentDate: staff.employment_date ?? "",
              gender: staff.gender ?? "",
              dateOfBirth: staff.date_of_birth ?? "",
              address: staff.address ?? "",
              qualification: staff.qualification ?? "",
              emergencyContactName: staff.emergency_contact_name ?? "",
              emergencyContactPhone: staff.emergency_contact_phone ?? "",
            }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Personal details
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Detail
              label="Gender"
              value={
                staff.gender
                  ? staff.gender === "male"
                    ? "Male"
                    : "Female"
                  : null
              }
            />
            <Detail
              label="Date of birth"
              value={staff.date_of_birth ? formatDate(staff.date_of_birth) : null}
            />
            <Detail label="Phone" value={staff.phone} />
            <Detail label="Email" value={staff.email} />
            <div className="col-span-2">
              <Detail label="Address" value={staff.address} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">Employment</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Detail
              label="Employment date"
              value={
                staff.employment_date ? formatDate(staff.employment_date) : null
              }
            />
            <Detail label="Qualification" value={staff.qualification} />
            <Detail
              label="Emergency contact"
              value={staff.emergency_contact_name}
            />
            <Detail
              label="Emergency phone"
              value={staff.emergency_contact_phone}
            />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Login and access</h2>

        {staff.user_id ? (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-slate-600">
              {staff.email ?? "This teacher"} can sign in to the teacher portal.
            </p>
            <ResetPasswordButton
              staffId={staff.id}
              name={name}
              email={staff.email ?? ""}
              disabled={Boolean(protectedReason)}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No portal access. Non-teaching staff only have a profile.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-600">
          {staff.is_active
            ? "Deactivating keeps all records but removes access. You can reactivate anytime."
            : "This staff member is inactive. Reactivating restores their access."}
        </p>

        {protectedReason ? (
          <p className="mt-2 text-sm text-slate-500">{protectedReason}</p>
        ) : null}

        <div className="mt-4">
          <StatusButton
            staffId={staff.id}
            name={name}
            isActive={staff.is_active}
            hasLogin={Boolean(staff.user_id)}
            disabled={Boolean(protectedReason)}
          />
        </div>
      </section>
    </div>
  );
}

function ProfileFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileContent params={params} />
    </Suspense>
  );
}
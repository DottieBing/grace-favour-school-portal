import { Suspense } from "react";

import { requirePageAccess } from "@/lib/auth/access";
import { getSchoolProfile } from "@/lib/settings/school";
import { createAdminClient } from "@/lib/supabase/admin";
import { HolidayManager } from "@/components/settings/holiday-manager";
import { LogoUploader } from "@/components/settings/logo-uploader";
import { SettingsForm } from "@/components/settings/settings-form";

async function SettingsContent() {
  await requirePageAccess("super_admin");

  const admin = createAdminClient();

  const [profile, holidaysResult] = await Promise.all([
    getSchoolProfile(),
    admin
      .from("school_holidays")
      .select("id, name, start_date, end_date")
      .order("start_date", { ascending: false }),
  ]);

  if (holidaysResult.error) {
    console.error("Unable to load holidays:", holidaysResult.error.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the settings. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          The school&apos;s details, logo and holidays. Only the owner can change these.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Logo</h2>
        <LogoUploader />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <SettingsForm
          initial={{
            name: profile.name,
            motto: profile.motto ?? "",
            address: profile.address ?? "",
            phone: profile.phone ?? "",
            email: profile.email ?? "",
            website: profile.website ?? "",
            admissionPrefix: profile.admissionPrefix,
            timetableDays: profile.timetableDays,
            teacherClashCheck: profile.teacherClashCheck,
          }}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">School holidays</h2>
          <p className="mt-1 text-sm text-slate-500">
            Attendance can&apos;t be marked on these days. Leave &quot;To&quot; empty for a single day.
          </p>
        </div>
        <HolidayManager
          holidays={(holidaysResult.data ?? []).map((item) => ({
            id: item.id as string,
            name: item.name as string,
            start: item.start_date as string,
            end: item.end_date as string,
          }))}
        />
      </section>
    </div>
  );
}

function SettingsFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent />
    </Suspense>
  );
}
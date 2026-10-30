import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SchoolProfile = {
  name: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  admissionPrefix: string;
  timetableDays: number[];
  teacherClashCheck: boolean;
};

const DEFAULTS: SchoolProfile = {
  name: "Grace & Favour Model School",
  motto: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  admissionPrefix: "GFMS",
  timetableDays: [1, 2, 3, 4, 5],
  teacherClashCheck: true,
};

export async function getSchoolProfile(): Promise<SchoolProfile> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("school_settings")
    .select(
      "name, motto, address, phone, email, website, admission_prefix, timetable_days, teacher_clash_check",
    )
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Unable to load school settings:", error.message);
    return DEFAULTS;
  }

  return {
    name: data.name as string,
    motto: (data.motto as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    website: (data.website as string | null) ?? null,
    admissionPrefix: data.admission_prefix as string,
    timetableDays: ((data.timetable_days as number[] | null) ?? DEFAULTS.timetableDays)
      .map(Number)
      .sort((a, b) => a - b),
    teacherClashCheck: data.teacher_clash_check as boolean,
  };
}
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type TeacherProfile = {
  staffId: string;
  name: string;
  photoUrl: string | null;
};

export async function loadTeacherProfile(
  admin: Admin,
  userId: string,
): Promise<TeacherProfile | null> {
  const { data, error } = await admin
    .from("staff")
    .select("id, full_name, staff_number, photo_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the teacher:", error.message);
    return null;
  }

  if (!data) return null;

  let photoUrl: string | null = null;

  if (data.photo_path) {
    const { data: signed } = await admin.storage
      .from("staff-photos")
      .createSignedUrl(data.photo_path as string, 3600);

    photoUrl = signed?.signedUrl ?? null;
  }

  return {
    staffId: data.id as string,
    name: (data.full_name as string | null) ?? (data.staff_number as string),
    photoUrl,
  };
}
import "server-only";

import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalStudent = {
  id: string;
  name: string;
  admissionNumber: string;
  className: string | null;
};

type Raw = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  status: string;
  classes: { name: string } | { name: string }[] | null;
};

/** The signed-in student, found from their login. Never from the URL. */
export async function requireStudent(): Promise<PortalStudent> {
  const { user } = await requirePageAccess("student");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("students")
    .select(
      "id, admission_number, first_name, middle_name, last_name, status, classes(name)",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the student:", error.message);
    throw new Error("Unable to verify your account.");
  }

  const row = data as unknown as Raw | null;

  if (!row || row.status !== "active") {
    redirect("/unauthorized");
  }

  const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;

  return {
    id: row.id,
    name: [row.first_name, row.middle_name, row.last_name]
      .filter(Boolean)
      .join(" "),
    admissionNumber: row.admission_number,
    className: cls?.name ?? null,
  };
}
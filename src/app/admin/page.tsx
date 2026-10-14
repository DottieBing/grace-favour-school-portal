export const instant = false;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "@/components/dashboard/admin-dashboard";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error("Unable to verify your school permissions.");
  }

  if (!roles?.some((item) => item.role === "super_admin")) {
    redirect("/unauthorized");
  }

  return <AdminDashboard />;
}

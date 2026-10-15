export const instant = false;

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentTerm } from "@/lib/academic/current-term";
import AdminDashboard from "@/components/dashboard/admin-dashboard";

export default async function AdminPage() {
  await requirePageAccess("super_admin");
  const term = await getCurrentTerm();

  return <AdminDashboard term={term} />;
}
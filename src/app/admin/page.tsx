export const instant = false;

import { requireAdminSession } from "@/lib/auth/access";
import { allows } from "@/lib/auth/permissions";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { SCHOOL_TIME_ZONE, formatLongDate, todayInSchool } from "@/lib/attendance/dates";
import { loadDashboard } from "@/lib/dashboard/stats";
import type { DashboardData, DashboardVisibility } from "@/lib/dashboard/types";
import AdminDashboard from "@/components/dashboard/admin-dashboard";

function greeting() {
  const hour = Number(
    new Date().toLocaleString("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: SCHOOL_TIME_ZONE,
    }),
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function mask(data: DashboardData, show: DashboardVisibility): DashboardData {
  return {
    students: show.students ? data.students : { total: 0, newThisSession: null },
    staff: show.staff ? data.staff : { teaching: 0, nonTeaching: 0 },
    attendanceToday: show.attendance
      ? data.attendanceToday
      : { percent: null, submitted: 0, expected: 0 },
    results: show.results ? data.results : { published: 0, submitted: 0, total: 0 },
    fees: show.fees ? data.fees : { collected: 0, outstanding: 0, reviewing: 0 },
    weekly: show.attendance ? data.weekly : [],
    weeklyAverage: show.attendance ? data.weeklyAverage : null,
    byClass: show.classes ? data.byClass : [],
    bySession: show.students ? data.bySession : [],
    pending: {
      results: show.results ? data.pending.results : 0,
      attendance: show.attendance ? data.pending.attendance : 0,
      payments: show.fees ? data.pending.payments : 0,
    },
  };
}

export default async function AdminPage() {
  const { permissions } = await requireAdminSession();

  const show: DashboardVisibility = {
    students: allows(permissions, "students", "view"),
    staff: allows(permissions, "staff", "view"),
    attendance: allows(permissions, "attendance", "view"),
    results: allows(permissions, "results", "view"),
    classes: allows(permissions, "classes", "view"),
    sessions: allows(permissions, "sessions", "view"),
    fees: allows(permissions, "fees", "view"),
    addStudents: allows(permissions, "students", "manage"),
  };

  const [term, data] = await Promise.all([
    getCurrentTerm(),
    loadDashboard({ fees: show.fees }),
  ]);

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the dashboard. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      data={mask(data, show)}
      show={show}
      term={term}
      greeting={greeting()}
      dateLabel={formatLongDate(todayInSchool())}
    />
  );
}
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { isWeekday, todayInSchool } from "@/lib/attendance/dates";
import { findTermForDate } from "@/lib/attendance/terms";
import type { DashboardData } from "@/lib/dashboard/types";
import { loadBalances } from "@/lib/fees/balances";

type Admin = ReturnType<typeof createAdminClient>;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** The Monday-to-Friday dates of the week containing `date`. */
function weekDates(date: string): string[] {
  const start = new Date(`${date}T00:00:00Z`);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() + (day === 0 ? -6 : 1 - day));

  return Array.from({ length: 5 }, (_, index) => {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() + index);
    return next.toISOString().slice(0, 10);
  });
}

async function dayCounts(admin: Admin, date: string) {
  const base = () =>
    admin
      .from("attendance_records")
      .select("id, attendance_registers!inner(attendance_date, status)", {
        count: "exact",
        head: true,
      })
      .eq("attendance_registers.attendance_date", date)
      .eq("attendance_registers.status", "submitted");

  const [total, absent] = await Promise.all([
    base(),
    base().eq("status", "absent"),
  ]);

  if (total.error || absent.error) {
    console.error(
      "Unable to count attendance:",
      total.error?.message ?? absent.error?.message,
    );
    return null;
  }

  return { total: total.count ?? 0, absent: absent.count ?? 0 };
}

export async function loadDashboard(
  options: { fees: boolean } = { fees: false },
): Promise<DashboardData | null> {
  const admin = createAdminClient();
  const today = todayInSchool();
  const dates = weekDates(today);

  const [studentsResult, staffResult, classesResult, session, term, todayRegisters, termToday] =
    await Promise.all([
      admin
        .from("students")
        .select("current_class_id, admission_session")
        .eq("status", "active")
        .limit(1000),
      admin.from("staff").select("staff_type").eq("is_active", true),
      admin
        .from("classes")
        .select("id, name, capacity")
        .eq("is_active", true)
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      getCurrentSession(),
      getCurrentTerm(),
      admin
        .from("attendance_registers")
        .select("class_id")
        .eq("attendance_date", today)
        .eq("status", "submitted"),
      findTermForDate(admin, today),
    ]);

  const failed =
    studentsResult.error ??
    staffResult.error ??
    classesResult.error ??
    todayRegisters.error;

  if (failed) {
    console.error("Unable to load dashboard:", failed.message);
    return null;
  }

  const students = studentsResult.data ?? [];

  const perClass = new Map<string, number>();
  const perSession = new Map<string, number>();

  for (const row of students) {
    if (row.current_class_id) {
      const id = row.current_class_id as string;
      perClass.set(id, (perClass.get(id) ?? 0) + 1);
    }

    if (row.admission_session) {
      const name = row.admission_session as string;
      perSession.set(name, (perSession.get(name) ?? 0) + 1);
    }
  }

  const classes = classesResult.data ?? [];

  const byClass = classes.map((item) => ({
    name: item.name as string,
    students: perClass.get(item.id as string) ?? 0,
    capacity: (item.capacity as number | null) ?? null,
  }));

  // Attendance for each school day of this week, up to today.
  const counts = await Promise.all(
    dates.map((date) => (date <= today ? dayCounts(admin, date) : null)),
  );

  const weekly = dates.map((_, index) => {
    const entry = counts[index];

    if (!entry || entry.total === 0) {
      return { day: DAY_LABELS[index], present: null, absent: null };
    }

    const absent = Math.round((entry.absent / entry.total) * 1000) / 10;

    return {
      day: DAY_LABELS[index],
      present: Math.round((100 - absent) * 10) / 10,
      absent,
    };
  });

  const withData = weekly.filter((item) => item.present !== null);
  const weeklyAverage =
    withData.length === 0
      ? null
      : Math.round(
          (withData.reduce((sum, item) => sum + (item.present ?? 0), 0) /
            withData.length) *
            10,
        ) / 10;

  const todayIndex = dates.indexOf(today);
  const todayEntry = todayIndex >= 0 ? weekly[todayIndex] : null;

  // Classes with students that should submit a register today.
  const expectedClasses = classes.filter(
    (item) => (perClass.get(item.id as string) ?? 0) > 0,
  );
  const submittedIds = new Set(
    (todayRegisters.data ?? []).map((item) => item.class_id as string),
  );
  const submittedCount = expectedClasses.filter((item) =>
    submittedIds.has(item.id as string),
  ).length;

  const registerDay =
    isWeekday(today) && termToday.ok && termToday.term !== null;

  const attendancePending = registerDay
    ? expectedClasses.length - submittedCount
    : 0;

  // Results for the current term.
  let results = { published: 0, submitted: 0, total: 0 };

  if (session && term) {
    const [sheetsResult, assignmentsResult] = await Promise.all([
      admin.from("result_sheets").select("status").eq("term_id", term.id),
      admin
        .from("teacher_assignments")
        .select("id", { count: "exact", head: true })
        .eq("academic_session_id", session.id)
        .eq("is_active", true),
    ]);

    if (sheetsResult.error || assignmentsResult.error) {
      console.error(
        "Unable to load results summary:",
        sheetsResult.error?.message ?? assignmentsResult.error?.message,
      );
      return null;
    }

    const sheets = sheetsResult.data ?? [];

    results = {
      published: sheets.filter((item) => item.status === "published").length,
      submitted: sheets.filter((item) => item.status === "submitted").length,
      total: assignmentsResult.count ?? 0,
    };
  }

  // Fees are only worked out for people who may see them.
  let fees = { collected: 0, outstanding: 0, reviewing: 0 };

  if (options.fees) {
    const [balances, reviewingResult] = await Promise.all([
      loadBalances(admin),
      admin
        .from("fee_payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "reviewing"),
    ]);

    if (!balances || reviewingResult.error) {
      console.error(
        "Unable to load fee totals:",
        reviewingResult.error?.message ?? "balances",
      );
      return null;
    }

    fees = {
      collected:
        Math.round(balances.reduce((sum, item) => sum + item.paid, 0) * 100) / 100,
      outstanding:
        Math.round(
          balances.reduce((sum, item) => sum + Math.max(0, item.balance), 0) * 100,
        ) / 100,
      reviewing: reviewingResult.count ?? 0,
    };
  }

  const staff = staffResult.data ?? [];

  return {
    students: {
      total: students.length,
      newThisSession: session
        ? students.filter((item) => item.admission_session === session.name).length
        : null,
    },
    staff: {
      teaching: staff.filter((item) => item.staff_type === "teaching").length,
      nonTeaching: staff.filter((item) => item.staff_type === "non_teaching").length,
    },
    attendanceToday: {
      percent: todayEntry?.present ?? null,
      submitted: submittedCount,
      expected: expectedClasses.length,
    },
    results,
    weekly,
    weeklyAverage,
    byClass,
    bySession: [...perSession.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, students: count })),
    fees,
    pending: {
      results: results.submitted,
      attendance: attendancePending,
      payments: fees.reviewing,
    },
  };
}
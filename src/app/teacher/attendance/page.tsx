import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { requirePageAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";
import {
  SCHOOL_TIME_ZONE,
  formatLongDate,
  isWeekday,
  todayInSchool,
} from "@/lib/attendance/dates";
import { loadRegisters } from "@/lib/attendance/load";
import { findTermForDate } from "@/lib/attendance/terms";
import { getSchoolProfile } from "@/lib/settings/school";
import { AttendanceExperience } from "@/components/attendance/attendance-experience";
import { RegisterForm } from "@/components/attendance/register-form";

function Page({ date, note, children }: { date: string; note?: string; children: ReactNode }) {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="anim-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">
          {formatLongDate(date)}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
      {children}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600">
      {children}
    </div>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {children}
    </div>
  );
}

async function AttendanceContent() {
  await connection();

  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();
  const today = todayInSchool();

  const [session, school] = await Promise.all([getCurrentSession(), getSchoolProfile()]);

  if (!session) {
    return (
      <Page date={today}>
        <Notice>No current term has been set. Please contact the administrator.</Notice>
      </Page>
    );
  }

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Unable to load staff record:", staffError.message);
    return (
      <Page date={today}>
        <Problem>We couldn&apos;t load your account. Please refresh the page.</Problem>
      </Page>
    );
  }

  if (!staff) {
    return (
      <Page date={today}>
        <Notice>Your staff record wasn&apos;t found. Please contact the administrator.</Notice>
      </Page>
    );
  }

  const { data: assignments, error: assignmentError } = await admin
    .from("teacher_assignments")
    .select("class_id")
    .eq("teacher_id", staff.id)
    .eq("academic_session_id", session.id)
    .eq("is_class_teacher", true)
    .eq("is_active", true);

  if (assignmentError) {
    console.error("Unable to load assignments:", assignmentError.message);
    return (
      <Page date={today}>
        <Problem>We couldn&apos;t load your classes. Please refresh the page.</Problem>
      </Page>
    );
  }

  const classIds = [...new Set((assignments ?? []).map((item) => item.class_id as string))];

  if (classIds.length === 0) {
    return (
      <Page date={today}>
        <Notice>
          Attendance is taken by the class teacher. You haven&apos;t been made a class teacher yet.
          Please contact the administrator.
        </Notice>
      </Page>
    );
  }

  let blocked: string | null = null;

  if (!isWeekday(today)) {
    blocked = "Today is a weekend, so there's no register to take.";
  } else {
    const lookup = await findTermForDate(admin, today);

    if (!lookup.ok) {
      return (
        <Page date={today}>
          <Problem>We couldn&apos;t check the school term. Please refresh the page.</Problem>
        </Page>
      );
    }

    if (lookup.holiday) {
      blocked = `Today is a school holiday: ${lookup.holiday}.`;
    } else if (!lookup.term) {
      blocked = "Today isn't within a school term.";
    } else if (lookup.term.sessionId !== session.id) {
      blocked = "Today's date doesn't match the current term. Please contact the administrator.";
    }
  }

  if (blocked) {
    return (
      <Page date={today}>
        <Notice>{blocked}</Notice>
      </Page>
    );
  }

  const [classesResult, data] = await Promise.all([
    admin
      .from("classes")
      .select("id, name")
      .in("id", classIds)
      .eq("is_active", true)
      .order("level_number", { ascending: true })
      .order("section", { ascending: true, nullsFirst: true }),
    loadRegisters(admin, classIds, today),
  ]);

  if (classesResult.error || !data) {
    if (classesResult.error) console.error("Unable to load classes:", classesResult.error.message);
    return (
      <Page date={today}>
        <Problem>We couldn&apos;t load the register. Please refresh the page.</Problem>
      </Page>
    );
  }

  const classes = classesResult.data ?? [];

  if (classes.length === 0) {
    return (
      <Page date={today}>
        <Notice>Your class is inactive. Please contact the administrator.</Notice>
      </Page>
    );
  }

  const confirmText =
    "Submit this register? You won't be able to change it afterwards. The administrator can reopen it if something is wrong.";

  return (
    <Page date={today} note={`due at ${school.attendanceTime}`}>
      {classes.map((item) => {
        const classId = item.id as string;
        const entry = data.get(classId);

        if (!entry) return null;

        const submitted = entry.register?.status === "submitted";
        const reopened = entry.register?.status === "reopened";

        const submittedTime = entry.register
          ? new Date(entry.register.submittedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: SCHOOL_TIME_ZONE,
            })
          : null;

        return (
          <section
            key={classId}
            className="anim-fade-up space-y-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{item.name as string}</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  submitted
                    ? "bg-emerald-50 text-emerald-700"
                    : reopened
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {submitted ? "Submitted" : reopened ? "Reopened" : "Not submitted"}
              </span>
            </div>

            {submitted ? (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                Submitted today at {submittedTime}. It&apos;s now locked. Contact the administrator if
                something needs changing.
              </p>
            ) : null}

            {reopened ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                The administrator reopened this register. Update it and submit again.
              </p>
            ) : null}

            {entry.students.length === 0 ? (
              <p className="text-sm text-slate-500">
                There are no active students in this class yet. The administrator assigns students to a
                class.
              </p>
            ) : submitted ? (
              <RegisterForm
                key={`${classId}-${today}-submitted`}
                classId={classId}
                date={today}
                students={entry.students}
                initial={entry.marks}
                endpoint="/api/teacher/attendance"
                readOnly
              />
            ) : (
              <AttendanceExperience
                key={`${classId}-${today}-${entry.register?.submittedAt ?? "new"}`}
                classId={classId}
                date={today}
                students={entry.students}
                initial={entry.marks}
                endpoint="/api/teacher/attendance"
                confirmText={confirmText}
              />
            )}
          </section>
        );
      })}
    </Page>
  );
}

export default function TeacherAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 p-4 sm:p-6">
          <div className="h-8 w-40 animate-pulse rounded bg-[#E3EAE6]" />
          <div className="h-72 animate-pulse rounded-3xl bg-[#E3EAE6]" />
        </div>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Moon,
} from "lucide-react";

import { requirePageAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { formatLongDate, isWeekday } from "@/lib/attendance/dates";
import { findTermForDate } from "@/lib/attendance/terms";
import { getSchoolProfile } from "@/lib/settings/school";
import { greetingFor, loadTeacherOverview, schoolNow } from "@/lib/teacher/overview";
import { loadTeacherProfile } from "@/lib/teacher/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/kit/avatar";
import { ProgressRing } from "@/components/kit/progress-ring";
import { StatusBadge } from "@/components/results/status-badge";

function Card({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <section
      className={`anim-fade-up rounded-2xl border border-black/5 bg-white p-5 shadow-sm ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="m-4 rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600 sm:m-6">
      {children}
    </div>
  );
}

async function HomeContent() {
  await connection();

  const { user } = await requirePageAccess("teacher");
  const admin = createAdminClient();
  const now = schoolNow();

  const [session, term, profile, school] = await Promise.all([
    getCurrentSession(),
    getCurrentTerm(),
    loadTeacherProfile(admin, user.id),
    getSchoolProfile(),
  ]);

  if (!profile) {
    return <Notice>Your staff record wasn&apos;t found. Please contact the administrator.</Notice>;
  }

  if (!session || !term) {
    return <Notice>No current term has been set yet. Please contact the administrator.</Notice>;
  }

  const [lookup, overview] = await Promise.all([
    findTermForDate(admin, now.date),
    loadTeacherOverview(admin, {
      staffId: profile.staffId,
      sessionId: session.id,
      termId: term.id,
      today: now.date,
      weekday: now.weekday,
    }),
  ]);

  if (!overview) {
    return <Notice>We couldn&apos;t load your dashboard. Please refresh the page.</Notice>;
  }

  const holiday = lookup.ok ? lookup.holiday : undefined;
  const schoolDay =
    isWeekday(now.date) && lookup.ok && lookup.term !== null && lookup.term.sessionId === session.id;
  const due = now.time >= school.attendanceTime;

  const firstName = profile.name.split(" ")[0];
  const classTeacherOf = overview.classes.filter((item) => item.isClassTeacher);

  const sheets = overview.classes.flatMap((item) =>
    item.subjects.map((subject) => ({ ...subject, classId: item.id, className: item.name })),
  );
  const doneSheets = sheets.filter(
    (item) => item.state === "submitted" || item.state === "published",
  ).length;
  const pendingSheets = sheets
    .filter((item) => item.state === "not_started" || item.state === "draft")
    .slice(0, 4);

  const nextIndex = overview.lessons.findIndex((item) => item.start > now.time);

  const noRegisterReason = !isWeekday(now.date)
    ? "It's the weekend, so there's no register today."
    : holiday
      ? `Today is a school holiday: ${holiday}.`
      : "Today isn't within a school term.";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <section className="anim-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D5C63] via-[#0B4F55] to-[#083B40] p-5 text-white shadow-lg shadow-[#0D5C63]/20 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-2 size-28 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-4">
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={64} className="ring-4 ring-white/20" />
          <div className="min-w-0">
            <p className="text-xs text-white/70">{formatLongDate(now.date)}</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {greetingFor(now.hour)}, {firstName}
            </h1>
            <p className="text-sm text-white/70">
              {term.sessionName} · {term.termName}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          {classTeacherOf.map((item) => (
            <span key={item.id} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              Class teacher · {item.name}
            </span>
          ))}
          <span className="rounded-full bg-[#C9A84C]/90 px-3 py-1 text-xs font-semibold text-[#153F40]">
            {overview.lessons.length} lesson{overview.lessons.length === 1 ? "" : "s"} today
          </span>
        </div>
      </section>

      {classTeacherOf.length > 0 ? (
        <div className="space-y-3">
          {classTeacherOf.map((item, index) => {
            const delay = 80 + index * 60;

            if (!schoolDay) {
              return (
                <Card key={item.id} delay={delay} className="flex items-center gap-4">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <Moon size={22} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.name} register</p>
                    <p className="text-sm text-slate-500">{noRegisterReason}</p>
                  </div>
                </Card>
              );
            }

            if (item.attendance === "submitted") {
              return (
                <Card key={item.id} delay={delay} className="flex items-center gap-4 border-emerald-200 bg-emerald-50/60">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={24} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{item.name} register is in</p>
                    <p className="text-sm text-emerald-800">Submitted for today. Nice work.</p>
                  </div>
                  <Link href="/teacher/attendance" className="text-sm font-medium text-[#0D5C63] hover:underline">
                    View
                  </Link>
                </Card>
              );
            }

            const reopened = item.attendance === "reopened";
            const glowing = due || reopened;

            return (
              <Card
                key={item.id}
                delay={delay}
                className={`flex items-center gap-4 ${
                  glowing ? "anim-pulse border-[#C9A84C]/60 bg-gradient-to-r from-[#FFF8E6] to-white" : ""
                }`}
              >
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                    glowing ? "bg-[#C9A84C] text-[#153F40]" : "bg-[#E6F0EC] text-[#0D5C63]"
                  }`}
                >
                  <ClipboardCheck size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {reopened ? "Register reopened" : "Take attendance"} · {item.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {reopened
                      ? "The administrator reopened it. Update and submit again."
                      : due
                        ? `${item.studentCount} students waiting. It was due at ${school.attendanceTime}.`
                        : `${item.studentCount} students. Due at ${school.attendanceTime}.`}
                  </p>
                </div>
                <Link
                  href="/teacher/attendance"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#0D5C63] px-4 text-sm font-medium text-white transition hover:bg-[#09494F]"
                >
                  Start
                  <ArrowRight size={16} />
                </Link>
              </Card>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Card delay={160}>
          <div className="flex items-center gap-4">
            <ProgressRing value={sheets.length === 0 ? 0 : doneSheets / sheets.length} size={84}>
              <span className="text-lg font-semibold text-slate-900">
                {doneSheets}/{sheets.length}
              </span>
            </ProgressRing>
            <div>
              <h2 className="font-semibold text-slate-900">Results</h2>
              <p className="text-sm text-slate-500">
                {sheets.length === 0
                  ? "No subjects assigned yet."
                  : doneSheets === sheets.length
                    ? "Every sheet is submitted. Brilliant."
                    : `${doneSheets} of ${sheets.length} subject sheets submitted.`}
              </p>
            </div>
          </div>

          {pendingSheets.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {pendingSheets.map((item) => (
                <li key={`${item.classId}:${item.id}`}>
                  <Link
                    href={`/teacher/results/${item.classId}/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/5 px-3 py-2.5 transition hover:bg-[#F4F7F5]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{item.name}</span>
                      <span className="block text-xs text-slate-500">{item.className}</span>
                    </span>
                    <StatusBadge state={item.state} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card delay={220}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Today&apos;s lessons</h2>
            <Link href="/teacher/timetable" className="text-sm font-medium text-[#0D5C63] hover:underline">
              Full week
            </Link>
          </div>

          {overview.lessons.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#F4F7F5] p-4 text-sm text-slate-500">
              <CalendarDays size={20} />
              No lessons on your timetable today.
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {overview.lessons.map((item, index) => {
                const current = item.start <= now.time && now.time < item.end;
                const past = item.end <= now.time;
                const next = index === nextIndex;

                return (
                  <li
                    key={`${item.start}-${index}`}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      current
                        ? "border-[#0D5C63] bg-[#0D5C63] text-white"
                        : "border-black/5"
                    } ${past ? "opacity-50" : ""}`}
                  >
                    <span className={`w-14 shrink-0 font-mono text-xs ${current ? "text-white/80" : "text-slate-500"}`}>
                      {item.start}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.subtitle ? (
                        <span className={`block truncate text-xs ${current ? "text-white/70" : "text-slate-500"}`}>
                          {item.subtitle}
                        </span>
                      ) : null}
                    </span>
                    {current ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">Now</span>
                    ) : next ? (
                      <span className="rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-xs font-medium text-[#8A6D1F]">Next</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {overview.classes.length > 0 ? (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-slate-900">My classes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.classes.map((item, index) => (
              <Card key={item.id} delay={280 + index * 60}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {item.studentCount} student{item.studentCount === 1 ? "" : "s"} ·{" "}
                      {item.subjects.length} subject{item.subjects.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {item.isClassTeacher ? (
                    <span className="rounded-full bg-[#E6F0EC] px-2.5 py-1 text-xs font-medium text-[#0D5C63]">
                      Class teacher
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.isClassTeacher ? (
                    <Link
                      href="/teacher/attendance"
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-sm font-medium text-slate-900 hover:bg-[#F4F7F5]"
                    >
                      <ClipboardCheck size={15} />
                      Attendance
                    </Link>
                  ) : null}
                  <Link
                    href="/teacher/results"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-sm font-medium text-slate-900 hover:bg-[#F4F7F5]"
                  >
                    <FileCheck2 size={15} />
                    Scores
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card delay={160}>
          <p className="text-sm text-slate-600">
            You haven&apos;t been assigned to a class yet. The administrator does this on the class page.
          </p>
        </Card>
      )}
    </div>
  );
}

export default function TeacherHomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 p-4 sm:p-6">
          <div className="h-40 animate-pulse rounded-3xl bg-[#E3EAE6]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[#E3EAE6]" />
          <div className="h-48 animate-pulse rounded-2xl bg-[#E3EAE6]" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
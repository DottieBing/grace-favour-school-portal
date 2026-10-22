"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  Plus,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardData, DashboardVisibility } from "@/lib/dashboard/types";

const TEAL = "#0D5C63";
const GOLD = "#C9A84C";

function StatCard({
  title,
  value,
  note,
  icon: Icon,
  background,
  color,
}: {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  background: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#E9ECE8] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#77817E]">{title}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#192F30]">
            {value}
          </h3>
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: background, color }}
        >
          <Icon size={19} strokeWidth={1.8} />
        </div>
      </div>
      <p className="mt-3 text-xs text-[#89918E]">{note}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-lg bg-[#F6F8F5] px-6 text-center text-sm text-[#7D8983]">
      {text}
    </div>
  );
}

export default function AdminDashboard({
  data,
  show,
  term,
  greeting,
  dateLabel,
}: {
  data: DashboardData;
  show: DashboardVisibility;
  term: { sessionName: string; termName: string } | null;
  greeting: string;
  dateLabel: string;
}) {
  const staffTotal = data.staff.teaching + data.staff.nonTeaching;
  const maxInClass = Math.max(1, ...data.byClass.map((item) => item.students));
  const hasWeekly = data.weekly.some((item) => item.present !== null);
  const pendingTotal = data.pending.results + data.pending.attendance;
  const anyStats = show.students || show.staff || show.attendance || show.results;
  const anyCharts = show.attendance || show.students;
  const showPending = show.results || show.attendance;

  const tasks = [
    {
      show: show.results,
      title: "Review submitted results",
      description:
        data.pending.results === 0
          ? "Nothing waiting for review"
          : `${data.pending.results} sheet${data.pending.results === 1 ? "" : "s"} ready to publish`,
      count: data.pending.results,
      href: "/admin/results",
      icon: FileCheck2,
      background: "#FFF2D8",
      color: "#946B16",
    },
    {
      show: show.attendance,
      title: "Attendance not submitted today",
      description:
        data.pending.attendance === 0
          ? "All registers are in, or it isn't a school day"
          : `${data.pending.attendance} class${data.pending.attendance === 1 ? "" : "es"} still to submit`,
      count: data.pending.attendance,
      href: "/admin/attendance",
      icon: CalendarCheck,
      background: "#F1E9FF",
      color: "#7651A8",
    },
  ].filter((task) => task.show);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 xl:px-9">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium text-[#84908A]">{dateLabel}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#1C3532]">
            {greeting}
          </h1>
          <p className="mt-1.5 text-sm text-[#7D8983]">
            Here&apos;s what&apos;s happening at the school today.
          </p>
        </div>

        {show.addStudents ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/students/import"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[#E2E8E1] bg-white px-3 text-sm font-medium text-[#40534C] hover:bg-[#F8FAF7]"
            >
              <Upload className="size-4" />
              Import students
            </Link>
            <Link
              href="/admin/students/new"
              className="inline-flex h-8 items-center gap-2 rounded-md bg-[#0D5C63] px-3 text-sm font-medium text-white hover:bg-[#09494F]"
            >
              <Plus className="size-4" />
              Add student
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-[#E0E9DE] bg-white p-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#E6F0EC] text-[#0D5C63]">
            <CalendarDays size={19} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#263F39]">
              {term
                ? `${term.sessionName.replace("/", " / ")} Academic Session`
                : "No current academic session"}
            </p>
            <p className="mt-0.5 text-xs text-[#85918A]">
              {term ? term.termName : "No current term is set"}
            </p>
          </div>
        </div>
        {!term && show.sessions ? (
          <Link
            href="/admin/sessions"
            className="text-sm font-medium text-[#0D5C63] hover:underline"
          >
            Set up sessions
          </Link>
        ) : null}
      </div>

      {anyStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {show.students ? (
            <StatCard
              title="Active students"
              value={String(data.students.total)}
              note={
                data.students.newThisSession === null
                  ? "No current session"
                  : `${data.students.newThisSession} admitted this session`
              }
              icon={GraduationCap}
              background="#E3F0ED"
              color="#0D5C63"
            />
          ) : null}
          {show.staff ? (
            <StatCard
              title="Teachers & staff"
              value={String(staffTotal)}
              note={`${data.staff.teaching} teaching · ${data.staff.nonTeaching} non-teaching`}
              icon={Users}
              background="#E9E7FA"
              color="#6557A7"
            />
          ) : null}
          {show.attendance ? (
            <StatCard
              title="Attendance today"
              value={
                data.attendanceToday.percent === null
                  ? "-"
                  : `${data.attendanceToday.percent}%`
              }
              note={
                data.attendanceToday.expected === 0
                  ? "No classes with students yet"
                  : `${data.attendanceToday.submitted} of ${data.attendanceToday.expected} registers submitted`
              }
              icon={CalendarCheck}
              background="#E4F0E2"
              color="#4E8148"
            />
          ) : null}
          {show.results ? (
            <StatCard
              title="Results published"
              value={`${data.results.published}/${data.results.total}`}
              note={`${data.results.submitted} waiting for review`}
              icon={FileCheck2}
              background="#F9EED5"
              color="#99721D"
            />
          ) : null}
        </div>
      ) : null}

      {anyCharts ? (
        <div
          className={`mt-6 grid grid-cols-1 gap-5 ${
            show.attendance && show.students ? "xl:grid-cols-[1.45fr_1fr]" : ""
          }`}
        >
          {show.attendance ? (
            <section className="min-w-0 rounded-xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#253D38]">
                    Attendance this week
                  </h3>
                  <p className="mt-1 text-xs text-[#89938E]">
                    Share of students attending each day. Late counts as attending.
                  </p>
                </div>
                {data.weeklyAverage !== null ? (
                  <span className="rounded-md bg-[#E7F2EC] px-2.5 py-1 text-xs font-medium text-[#39734F]">
                    {data.weeklyAverage}% avg.
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                {hasWeekly ? (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.weekly}
                        margin={{ top: 8, right: 0, left: -24, bottom: 0 }}
                        barGap={6}
                      >
                        <CartesianGrid vertical={false} stroke="#EEF1ED" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#929B96", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#929B96", fontSize: 12 }}
                          domain={[0, 100]}
                          ticks={[0, 25, 50, 75, 100]}
                        />
                        <Tooltip />
                        <Bar dataKey="present" name="Attending (%)" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="absent" name="Absent (%)" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty text="No registers have been submitted this week yet." />
                )}
              </div>
            </section>
          ) : null}

          {show.students ? (
            <section className="min-w-0 rounded-xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#253D38]">
                Students by admission session
              </h3>
              <p className="mt-1 text-xs text-[#89938E]">
                Active students, by the session they joined.
              </p>

              <div className="mt-5">
                {data.bySession.length === 0 ? (
                  <Empty text="No students yet." />
                ) : (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.bySession}
                        margin={{ top: 8, right: 0, left: -24, bottom: 0 }}
                      >
                        <CartesianGrid vertical={false} stroke="#EEF1ED" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#929B96", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#929B96", fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <Tooltip />
                        <Bar dataKey="students" name="Students" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {show.classes || showPending ? (
        <div
          className={`mt-6 grid grid-cols-1 gap-5 ${
            show.classes && showPending ? "xl:grid-cols-[1.1fr_0.9fr]" : ""
          }`}
        >
          {show.classes ? (
            <section className="rounded-xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#253D38]">Students by class</h3>
                  <p className="mt-1 text-xs text-[#89938E]">
                    Bars show the class size against its capacity, or the largest class.
                  </p>
                </div>
                <Link
                  href="/admin/classes"
                  className="text-sm font-medium text-[#0D5C63] hover:underline"
                >
                  View classes
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {data.byClass.length === 0 ? (
                  <p className="text-sm text-[#7D8983]">No active classes yet.</p>
                ) : (
                  data.byClass.map((item) => {
                    const base = item.capacity ?? maxInClass;
                    const percent = Math.min(100, (item.students / base) * 100);

                    return (
                      <div key={item.name}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-[#64716B]">{item.name}</span>
                          <span className="font-semibold text-[#334A42]">
                            {item.students}
                            {item.capacity ? ` / ${item.capacity}` : ""}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#EEF1EC]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percent}%`,
                              backgroundColor:
                                item.capacity && item.students > item.capacity ? GOLD : TEAL,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {showPending ? (
            <section className="rounded-xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#253D38]">Pending actions</h3>
                  <p className="mt-1 text-xs text-[#89938E]">Items that need attention</p>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    pendingTotal === 0
                      ? "bg-[#E7F2EC] text-[#39734F]"
                      : "bg-[#FFF1D7] text-[#936818]"
                  }`}
                >
                  {pendingTotal === 0 ? "All clear" : `${pendingTotal} pending`}
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {tasks.map((task) => {
                  const Icon = task.icon;

                  return (
                    <Link
                      key={task.title}
                      href={task.href}
                      className="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-[#F7F9F6]"
                    >
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: task.background, color: task.color }}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#253B39]">{task.title}</p>
                        <p className="mt-0.5 text-xs text-[#8A9590]">{task.description}</p>
                      </div>
                      <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F1F3EF] px-1.5 text-xs font-semibold text-[#596660]">
                        {task.count}
                      </div>
                      <ChevronRight
                        size={15}
                        className="text-[#A6AEAA] transition group-hover:translate-x-0.5"
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-8 pb-5 text-xs text-[#929B95]">
        © 2026 Grace &amp; Favour Model School
      </footer>
    </div>
  );
}
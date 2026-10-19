"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  GraduationCap,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = {
  teal: "#0D5C63",
  gold: "#C9A84C",
  lime: "#A8D832",
};

const enrollmentData = [
  { month: "Jan", students: 284 },
  { month: "Feb", students: 302 },
  { month: "Mar", students: 310 },
  { month: "Apr", students: 325 },
  { month: "May", students: 319 },
  { month: "Jun", students: 338 },
  { month: "Jul", students: 346 },
  { month: "Aug", students: 352 },
  { month: "Sep", students: 368 },
  { month: "Oct", students: 382 },
  { month: "Nov", students: 0 },
  { month: "Dec", students: 0 },
];

const attendanceData = [
  { day: "Mon", present: 91, absent: 9 },
  { day: "Tue", present: 94, absent: 6 },
  { day: "Wed", present: 89, absent: 11 },
  { day: "Thu", present: 96, absent: 4 },
  { day: "Fri", present: 93, absent: 7 },
];

const classData = [
  { name: "Nursery 1", students: 28 },
  { name: "Nursery 2", students: 32 },
  { name: "Primary 1", students: 41 },
  { name: "Primary 2", students: 38 },
  { name: "Primary 3", students: 35 },
  { name: "Primary 4", students: 40 },
  { name: "Primary 5", students: 34 },
  { name: "Primary 6", students: 36 },
];

const recentPayments = [
  {
    name: "Amara Johnson",
    initials: "AJ",
    reference: "PAY-2026-001",
    amount: 95000,
    date: "Today, 10:42 AM",
    status: "Verified",
    color: "#E0F2E9",
    textColor: "#176B45",
  },
  {
    name: "Daniel Williams",
    initials: "DW",
    reference: "PAY-2026-002",
    amount: 50000,
    date: "Today, 09:18 AM",
    status: "Pending",
    color: "#FFF1D6",
    textColor: "#966000",
  },
  {
    name: "Esther Adeyemi",
    initials: "EA",
    reference: "PAY-2026-003",
    amount: 95000,
    date: "Yesterday",
    status: "Verified",
    color: "#E0F2E9",
    textColor: "#176B45",
  },
];

const pendingTasks = [
  {
    title: "Verify fee payment",
    description: "2 receipts awaiting verification",
    icon: Wallet,
    color: "#E5F2F2",
    iconColor: "#0D5C63",
    count: 2,
  },
  {
    title: "Review submitted results",
    description: "3 class submissions need review",
    icon: FileCheck2,
    color: "#FFF2D8",
    iconColor: "#946B16",
    count: 3,
  },
  {
    title: "Attendance follow-up",
    description: "1 class has not submitted attendance",
    icon: CalendarCheck,
    color: "#F1E9FF",
    iconColor: "#7651A8",
    count: 1,
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatCard({
  title,
  value,
  change,
  description,
  icon: Icon,
  positive = true,
  iconBackground,
  iconColor,
}: {
  title: string;
  value: string;
  change: string;
  description: string;
  icon: LucideIcon;
  positive?: boolean;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E9ECE8] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#77817E]">{title}</p>
          <h3 className="mt-3 text-[25px] font-bold tracking-tight text-[#192F30] sm:text-[28px]">
            {value}
          </h3>
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBackground, color: iconColor }}
        >
          <Icon size={21} strokeWidth={1.8} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-bold ${
            positive
              ? "bg-[#E5F5EB] text-[#24784B]"
              : "bg-[#FCEAE7] text-[#B84E40]"
          }`}
        >
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {change}
        </span>
        <span className="text-xs text-[#89918E]">{description}</span>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[#E7EBE7] bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs text-[#7C8783]">{label}</p>
      {payload.map((item, index) => (
        <p key={index} className="text-xs font-bold text-[#0D5C63]">
          {item.name === "students"
            ? `${item.value} students`
            : `${item.value}%`}
        </p>
      ))}
    </div>
  );
}

function EnrollmentChart() {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={enrollmentData}
          margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id="enrollmentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND.teal} stopOpacity={0.18} />
              <stop offset="95%" stopColor={BRAND.teal} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="#EEF1ED" strokeDasharray="4 4" />

          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#929B96", fontSize: 11 }}
            dy={10}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#929B96", fontSize: 10 }}
            domain={[0, 450]}
            ticks={[0, 100, 200, 300, 400]}
          />

          <Tooltip content={<ChartTooltip />} />

          <Area
            type="monotone"
            dataKey="students"
            name="students"
            stroke={BRAND.teal}
            strokeWidth={2.5}
            fill="url(#enrollmentGradient)"
            activeDot={{
              r: 5,
              fill: BRAND.teal,
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AttendanceChart() {
  return (
    <div className="h-[225px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={attendanceData}
          margin={{ top: 8, right: 0, left: -28, bottom: 0 }}
          barGap={6}
        >
          <CartesianGrid vertical={false} stroke="#EEF1ED" strokeDasharray="4 4" />

          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#929B96", fontSize: 11 }}
            dy={8}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#929B96", fontSize: 10 }}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />

          <Tooltip />

          <Bar
            dataKey="present"
            name="Present (%)"
            fill={BRAND.teal}
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />

          <Bar
            dataKey="absent"
            name="Absent (%)"
            fill={BRAND.gold}
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TaskList({ onSelect }: { onSelect: (title: string) => void }) {
  return (
    <div className="space-y-4">
      {pendingTasks.map((task) => {
        const Icon = task.icon;

        return (
          <button
            key={task.title}
            type="button"
            onClick={() => onSelect(task.title)}
            className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[#F7F9F6]"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: task.color, color: task.iconColor }}
            >
              <Icon size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#253B39]">{task.title}</p>
              <p className="mt-1 text-xs leading-4 text-[#8A9590]">
                {task.description}
              </p>
            </div>

            <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F1F3EF] px-1.5 text-xs font-bold text-[#596660]">
              {task.count}
            </div>

            <ChevronRight
              size={15}
              className="text-[#A6AEAA] transition group-hover:translate-x-0.5"
            />
          </button>
        );
      })}
    </div>
  );
}

export default function AdminDashboard({
  term,
}: {
  term: { sessionName: string; termName: string } | null;
}) {
  const [period, setPeriod] = useState("This academic year");
  const [notice, setNotice] = useState("");

  function comingSoon(feature: string) {
    setNotice(`${feature} will be connected when we build that module.`);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 xl:px-9">
      {/* Welcome section */}
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium text-[#84908A]">
            Friday, October 9, 2026
          </p>

          <h1 className="mt-2 text-[25px] font-bold tracking-tight text-[#1C3532] sm:text-[30px]">
            Good evening, Administrator <span aria-hidden="true">👋</span>
          </h1>

          <p className="mt-2 max-w-xl text-xs leading-6 text-[#7D8983] sm:text-sm">
            Here's what's happening at your school. Let's keep everything
            running smoothly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => comingSoon("Report export")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8E1] bg-white px-4 py-2.5 text-xs font-semibold text-[#40534C] transition hover:bg-[#F8FAF7]"
          >
            <Download size={15} />
            Export report
          </button>

          <button
            type="button"
            onClick={() => comingSoon("Student registration")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D5C63] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#09494F]"
          >
            <Plus size={15} />
            Add student
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#D5E7DD] bg-[#F0F8F3] px-4 py-3 text-xs text-[#245D43]"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Academic session banner */}
      <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-[#E0E9DE] bg-white p-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F0EC] text-[#0D5C63]">
            <CalendarDays size={19} />
          </div>

          <div>
            <p className="text-xs font-bold text-[#263F39]">
              {term
                ? `${term.sessionName.replace("/", " / ")} Academic Session`
                : "No current academic session"}
            </p>
            <p className="mt-1 text-xs text-[#85918A]">
              {term
                ? `${term.termName} · Academic overview`
                : "Set a current term in Academic Sessions"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#6DA77D]" />
          <span className="text-xs font-semibold text-[#53745D]">
            Session active
          </span>

          <div className="ml-2 h-5 w-px bg-[#E6EBE4]" />

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="max-w-[155px] cursor-pointer bg-transparent py-1 text-xs font-semibold text-[#465A51] outline-none"
            aria-label="Analytics period"
          >
            <option>This academic year</option>
            <option>This term</option>
            <option>Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Main statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total students"
          value="382"
          change="+8.4%"
          description="vs previous session"
          icon={GraduationCap}
          iconBackground="#E3F0ED"
          iconColor="#0D5C63"
        />

        <StatCard
          title="Teachers & staff"
          value="24"
          change="+2"
          description="new this session"
          icon={Users}
          iconBackground="#E9E7FA"
          iconColor="#6557A7"
        />

        <StatCard
          title="Fees collected"
          value="₦18.4M"
          change="+12.6%"
          description="vs previous term"
          icon={CircleDollarSign}
          iconBackground="#F9EED5"
          iconColor="#99721D"
        />

        <StatCard
          title="Attendance today"
          value="93.2%"
          change="-1.8%"
          description="vs yesterday"
          icon={CalendarCheck}
          positive={false}
          iconBackground="#E4F0E2"
          iconColor="#4E8148"
        />
      </div>

      {/* Analytics charts */}
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="min-w-0 rounded-2xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#253D38]">
                Student enrollment
              </h3>
              <p className="mt-1 text-xs text-[#89938E]">
                Enrollment overview across the academic year
              </p>
            </div>

            <button
              type="button"
              aria-label="Enrollment chart options"
              onClick={() => comingSoon("Enrollment chart options")}
              className="rounded-lg p-1.5 text-[#89938E] hover:bg-[#F5F7F3]"
            >
              <MoreHorizontal size={19} />
            </button>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3">
            <div>
              <h4 className="text-[26px] font-bold tracking-tight text-[#203B36]">
                382
              </h4>
              <p className="mt-1 text-xs text-[#87938C]">
                Total enrolled students
              </p>
            </div>

            <span className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-[#348257]">
              <TrendingUp size={13} />
              Growing enrollment
            </span>
          </div>

          <div className="mt-4">
            <EnrollmentChart />
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#253D38]">
                Weekly attendance
              </h3>
              <p className="mt-1 text-xs text-[#89938E]">
                Student attendance this week
              </p>
            </div>

            <span className="rounded-lg bg-[#E7F2EC] px-2.5 py-1.5 text-xs font-bold text-[#39734F]">
              93.2% avg.
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0D5C63]" />
              <span className="text-xs text-[#78857E]">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#C9A84C]" />
              <span className="text-xs text-[#78857E]">Absent</span>
            </div>
          </div>

          <div className="mt-4">
            <AttendanceChart />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F6F8F5] p-3">
            <CheckCircle2 size={17} className="shrink-0 text-[#43845A]" />
            <p className="text-xs leading-5 text-[#64746A]">
              Attendance data will be connected to daily teacher submissions.
            </p>
          </div>
        </section>
      </div>

      {/* Class distribution and administrative tasks */}
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#253D38]">
                Students by class
              </h3>
              <p className="mt-1 text-xs text-[#89938E]">
                Enrollment distribution across classes
              </p>
            </div>

            <button
              type="button"
              onClick={() => comingSoon("The classes page")}
              className="text-xs font-bold text-[#0D5C63] hover:underline"
            >
              View classes
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {classData.map((item) => {
              const percentage = (item.students / 45) * 100;

              return (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[#64716B]">
                      {item.name}
                    </span>
                    <span className="text-xs font-bold text-[#334A42]">
                      {item.students}{" "}
                      <span className="font-normal text-[#9AA39D]">students</span>
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-[#EEF1EC]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          item.name === "Primary 1" || item.name === "Primary 4"
                            ? BRAND.gold
                            : BRAND.teal,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E8ECE7] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#253D38]">
                Pending actions
              </h3>
              <p className="mt-1 text-xs text-[#89938E]">
                Items that need your attention
              </p>
            </div>

            <span className="rounded-lg bg-[#FFF1D7] px-2.5 py-1.5 text-xs font-bold text-[#936818]">
              6 pending
            </span>
          </div>

          <div className="mt-5">
            <TaskList onSelect={comingSoon} />
          </div>

          <div className="mt-5 border-t border-[#EDF0EB] pt-4">
            <button
              type="button"
              onClick={() => comingSoon("The task centre")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E1E8E0] py-3 text-xs font-bold text-[#0D5C63] transition hover:bg-[#F5F8F4]"
            >
              View all tasks
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
      </div>

      {/* Recent payments */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#E8ECE7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0EB] px-5 py-5 sm:px-6">
          <div>
            <h3 className="text-sm font-bold text-[#253D38]">
              Recent fee payments
            </h3>
            <p className="mt-1 text-xs text-[#89938E]">
              Overview of recently submitted payment records
            </p>
          </div>

          <button
            type="button"
            onClick={() => comingSoon("The payments page")}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0D5C63] hover:underline"
          >
            View all payments
            <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left">
            <thead>
              <tr className="bg-[#FAFBF9]">
                {["Guardian / Student", "Reference", "Amount", "Date", "Status", "Action"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#8B9690]"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {recentPayments.map((payment) => (
                <tr
                  key={payment.reference}
                  className="border-t border-[#F0F2EE] transition hover:bg-[#FCFDFB]"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: payment.color,
                          color: payment.textColor,
                        }}
                      >
                        {payment.initials}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#344841]">
                          {payment.name}
                        </p>
                        <p className="mt-1 text-xs text-[#929B95]">
                          Fee payment
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-xs text-[#75827A]">
                    {payment.reference}
                  </td>

                  <td className="px-6 py-4 text-xs font-bold text-[#344841]">
                    {formatCurrency(payment.amount)}
                  </td>

                  <td className="px-6 py-4 text-xs text-[#75827A]">
                    {payment.date}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: payment.color,
                        color: payment.textColor,
                      }}
                    >
                      {payment.status === "Verified" ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <Clock3 size={12} />
                      )}
                      {payment.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => comingSoon("Payment verification")}
                      className="rounded-lg p-2 text-[#7D8A82] transition hover:bg-[#EAF2ED] hover:text-[#0D5C63]"
                      aria-label={`View payment ${payment.reference}`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF0EB] px-5 py-4 sm:px-6">
          <p className="text-xs text-[#89938E]">
            Showing 3 sample payment records
          </p>
          <button
            type="button"
            onClick={() => comingSoon("Payment history")}
            className="text-xs font-bold text-[#0D5C63] hover:underline"
          >
            View payment history
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 flex flex-col items-center justify-between gap-2 pb-5 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-[#929B95]">
          © 2026 Grace & Favour Model School
        </p>
        <p className="flex items-center gap-1.5 text-xs text-[#929B95]">
          <ShieldCheck size={13} className="text-[#0D5C63]" />
          School administration workspace
        </p>
      </footer>
    </div>
  );
}
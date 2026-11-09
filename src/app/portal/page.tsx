import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Trophy } from "lucide-react";

import { formatLongDate } from "@/lib/attendance/dates";
import { loadLedger } from "@/lib/fees/ledger";
import { naira } from "@/lib/fees/money";
import { loadAttendanceSummary } from "@/lib/portal/attendance";
import { requireStudent } from "@/lib/portal/student";
import { ordinal } from "@/lib/results/ordinal";
import { loadStudentResults } from "@/lib/results/student-results";
import { greetingFor, schoolNow } from "@/lib/teacher/overview";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeeStatusBadge } from "@/components/fees/status-badge";
import { Avatar } from "@/components/kit/avatar";
import { Card } from "@/components/kit/card";
import { ProgressRing } from "@/components/kit/progress-ring";

const DOT = { present: "bg-emerald-500", late: "bg-amber-400", absent: "bg-red-500" } as const;

async function HomeContent() {
  await connection();

  const student = await requireStudent();
  const admin = createAdminClient();
  const now = schoolNow();

  const [attendance, terms, ledger] = await Promise.all([
    loadAttendanceSummary(admin, student.id),
    loadStudentResults(admin, student.id),
    loadLedger(admin, student.id),
  ]);

  const latest = terms && terms.length > 0 ? terms[terms.length - 1] : null;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <section className="anim-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D5C63] via-[#0B4F55] to-[#083B40] p-5 text-white shadow-lg shadow-[#0D5C63]/20 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-4">
          <Avatar name={student.name} photoUrl={student.photoUrl} size={76} className="ring-4 ring-white/20" />
          <div className="min-w-0">
            <p className="text-xs text-white/70">{formatLongDate(now.date)}</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {greetingFor(now.hour)}, {student.firstName}
            </h1>
            <p className="text-sm text-white/70">{student.className ?? "No class yet"}</p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs backdrop-blur">
            {student.admissionNumber}
          </span>
          {latest?.position ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A84C]/90 px-3 py-1 text-xs font-semibold text-[#153F40]">
              <Trophy size={13} />
              {ordinal(latest.position)} in class
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Card delay={80}>
          <h2 className="font-semibold text-slate-900">Attendance</h2>

          {!attendance ? (
            <p className="mt-3 text-sm text-slate-500">We couldn&apos;t load attendance. Please refresh.</p>
          ) : attendance.total === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nothing recorded yet. It appears once the class teacher submits the register.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4">
                <ProgressRing value={(attendance.rate ?? 0) / 100} size={88}>
                  <span className="text-lg font-semibold text-slate-900">{attendance.rate}%</span>
                </ProgressRing>
                <div className="text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-emerald-700">{attendance.present}</span> present
                  </p>
                  <p>
                    <span className="font-semibold text-amber-600">{attendance.late}</span> late
                  </p>
                  <p>
                    <span className="font-semibold text-red-600">{attendance.absent}</span> absent
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-500">Last {attendance.recent.length} school days</p>
                <div className="flex flex-wrap gap-1.5">
                  {attendance.recent.map((item) => (
                    <span
                      key={item.date}
                      title={`${item.date}: ${item.status}`}
                      className={`size-3.5 rounded-full ${DOT[item.status]}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>

        <Card delay={140}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Latest results</h2>
            {latest ? (
              <Link href={`/portal/results/${latest.termId}`} className="text-sm font-medium text-[#0D5C63] hover:underline">
                Report card
              </Link>
            ) : null}
          </div>

          {!terms ? (
            <p className="mt-3 text-sm text-slate-500">We couldn&apos;t load results. Please refresh.</p>
          ) : !latest ? (
            <p className="mt-3 text-sm text-slate-500">
              Results appear here once the school publishes them.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">
                {latest.termName}, {latest.sessionName}
              </p>
              <div className="mt-3 flex items-end gap-6">
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-slate-900">{latest.average}%</p>
                  <p className="text-xs text-slate-500">average</p>
                </div>
                {latest.position ? (
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-[#0D5C63]">
                      {ordinal(latest.position)}
                    </p>
                    <p className="text-xs text-slate-500">of {latest.outOf} in class</p>
                  </div>
                ) : null}
              </div>

              <ul className="mt-4 space-y-1.5">
                {latest.subjects.slice(0, 5).map((item) => (
                  <li key={item.subject} className="flex items-center justify-between text-sm">
                    <span className="truncate text-slate-700">{item.subject}</span>
                    <span className="ml-3 rounded-full bg-[#E6F0EC] px-2.5 py-0.5 text-xs font-semibold text-[#0D5C63]">
                      {item.grade} · {item.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card delay={200}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">School fees</h2>
          {ledger ? <FeeStatusBadge status={ledger.status} /> : null}
        </div>

        {!ledger ? (
          <p className="mt-3 text-sm text-slate-500">We couldn&apos;t load fees. Please refresh.</p>
        ) : ledger.status === "no_charges" ? (
          <p className="mt-3 text-sm text-slate-500">No fees have been charged yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-slate-900">
                {ledger.balance <= 0 ? naira(0) : naira(ledger.balance)}
              </p>
              <p className="text-sm text-slate-500">
                {ledger.status === "paid"
                  ? "You're all paid up. Thank you!"
                  : ledger.status === "reviewing"
                    ? "We're checking your receipt."
                    : "balance remaining"}
              </p>
            </div>
            <Link
              href="/portal/fees#pay"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0D5C63] px-5 text-sm font-medium text-white transition hover:bg-[#09494F]"
            >
              {ledger.status === "paid" || ledger.status === "reviewing" ? "View fees" : "Pay now"}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function PortalHomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 p-4 sm:p-6">
          <div className="h-40 animate-pulse rounded-3xl bg-[#E3EAE6]" />
          <div className="h-48 animate-pulse rounded-2xl bg-[#E3EAE6]" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
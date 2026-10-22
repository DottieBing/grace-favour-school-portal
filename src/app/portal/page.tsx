import { Suspense } from "react";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/portal/student";
import { loadStudentResults } from "@/lib/results/student-results";

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          value === "-" ? "text-slate-300" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{note}</div>
    </div>
  );
}

async function OverviewContent() {
  const student = await requireStudent();
  const admin = createAdminClient();

  const [attendanceResult, terms] = await Promise.all([
    admin
      .from("attendance_records")
      .select("status, attendance_registers!inner(status)")
      .eq("student_id", student.id)
      .eq("attendance_registers.status", "submitted"),
    loadStudentResults(admin, student.id),
  ]);

  let attendanceValue = "-";
  let attendanceNote = "No data yet";

  if (attendanceResult.error) {
    console.error("Unable to load attendance:", attendanceResult.error.message);
    attendanceNote = "Couldn't load";
  } else {
    const records = attendanceResult.data ?? [];

    if (records.length > 0) {
      const attended = records.filter((item) => item.status !== "absent").length;
      attendanceValue = `${Math.round((attended / records.length) * 100)}%`;
      attendanceNote = `${records.length} day${records.length === 1 ? "" : "s"} recorded`;
    }
  }

  const latest = terms && terms.length > 0 ? terms[terms.length - 1] : null;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{student.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {student.className ?? "No class"} ·{" "}
          <span className="font-mono">{student.admissionNumber}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card label="Attendance rate" value={attendanceValue} note={attendanceNote} />
        <Card
          label="Latest average"
          value={latest ? `${latest.average}%` : "-"}
          note={
            !terms
              ? "Couldn't load"
              : latest
                ? `${latest.termName}, ${latest.sessionName}`
                : "No published results yet"
          }
        />
      </div>

      {latest ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {latest.termName}, {latest.sessionName}
            </h2>
            <Link
              href={`/portal/results/${latest.termId}`}
              className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Report card
            </Link>
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 pr-3 font-medium">%</th>
                <th className="py-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {latest.subjects.map((item) => (
                <tr key={item.subject} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-slate-900">{item.subject}</td>
                  <td className="py-2 pr-3">{item.percent}%</td>
                  <td className="py-2 font-medium text-slate-900">{item.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

export default function PortalHomePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <OverviewContent />
    </Suspense>
  );
}
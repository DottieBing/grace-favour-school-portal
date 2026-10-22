import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStudentResults } from "@/lib/results/student-results";
import { PrintButton } from "@/components/students/print-button";
import { SchoolLogo } from "@/components/brand/school-logo";

async function ReportContent({
  params,
}: {
  params: Promise<{ id: string; termId: string }>;
}) {
  await requireAreaAccess("students");
  const { id, termId } = await params;

  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(termId).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [studentResult, terms, attendanceResult] = await Promise.all([
    admin
      .from("students")
      .select("first_name, middle_name, last_name, admission_number, gender")
      .eq("id", id)
      .maybeSingle(),
    loadStudentResults(admin, id),
    admin
      .from("attendance_records")
      .select("status, attendance_registers!inner(term_id, status)")
      .eq("student_id", id)
      .eq("attendance_registers.term_id", termId)
      .eq("attendance_registers.status", "submitted"),
  ]);

  if (studentResult.error || !terms || attendanceResult.error) {
    console.error(
      "Unable to load report card:",
      studentResult.error?.message ?? attendanceResult.error?.message,
    );

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this report card. Please refresh the page.
        </div>
      </div>
    );
  }

  const student = studentResult.data;

  if (!student) {
    notFound();
  }

  const term = terms.find((item) => item.termId === termId);

  if (!term) {
    notFound();
  }

  const name = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");

  const marks = attendanceResult.data ?? [];
  const present = marks.filter((item) => item.status === "present").length;
  const absent = marks.filter((item) => item.status === "absent").length;
  const late = marks.filter((item) => item.status === "late").length;

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/students/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to student
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="border-b border-slate-200 pb-4 text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center">
            <SchoolLogo size={56} />
        </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Grace &amp; Favour Model School
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Report card · {term.termName}, {term.sessionName}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Student</div>
            <div className="font-medium text-slate-900">{name}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Admission number</div>
            <div className="font-mono text-slate-900">{student.admission_number}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Class</div>
            <div className="text-slate-900">{term.className}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Position</div>
            <div className="text-slate-900">
              {term.position ? `${term.position} of ${term.outOf}` : "-"}
            </div>
          </div>
        </section>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Subject</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 pr-3 font-medium">%</th>
              <th className="py-2 pr-3 font-medium">Grade</th>
              <th className="py-2 font-medium">Remark</th>
            </tr>
          </thead>
          <tbody>
            {term.subjects.map((item) => (
              <tr key={item.subject} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3">
                  <div className="font-medium text-slate-900">{item.subject}</div>
                  <div className="text-xs text-slate-500">
                    {item.breakdown
                      .map((part) => `${part.name} ${part.score}/${part.max}`)
                      .join(" · ")}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  {item.total}/{item.max}
                </td>
                <td className="py-2 pr-3">{item.percent}%</td>
                <td className="py-2 pr-3 font-medium text-slate-900">{item.grade}</td>
                <td className="py-2 text-slate-600">{item.remark ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Average</div>
            <div className="font-semibold text-slate-900">{term.average}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Days present</div>
            <div className="text-slate-900">{present}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Days absent</div>
            <div className="text-slate-900">{absent}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Days late</div>
            <div className="text-slate-900">{late}</div>
          </div>
        </section>

        <p className="text-xs text-slate-400">
          Grades are as published for this term. Position is based on the average
          across published subjects.
        </p>
      </div>
    </div>
  );
}

function ReportFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function ReportCardPage({
  params,
}: {
  params: Promise<{ id: string; termId: string }>;
}) {
  return (
    <Suspense fallback={<ReportFallback />}>
      <ReportContent params={params} />
    </Suspense>
  );
}
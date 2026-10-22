import { Suspense } from "react";

import { requireStudent } from "@/lib/portal/student";
import { StudentAttendanceSection } from "@/components/students/student-attendance-section";

async function AttendanceContent() {
  const student = await requireStudent();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">{student.name}</p>
      </div>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}>
        <StudentAttendanceSection studentId={student.id} />
      </Suspense>
    </div>
  );
}

export default function PortalAttendancePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" />}>
      <AttendanceContent />
    </Suspense>
  );
}
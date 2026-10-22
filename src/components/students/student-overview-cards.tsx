import { createAdminClient } from "@/lib/supabase/admin";
import { loadStudentResults } from "@/lib/results/student-results";

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  const empty = value === "-";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          empty ? "text-slate-300" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{note}</div>
    </div>
  );
}

export async function StudentOverviewCards({ studentId }: { studentId: string }) {
  const admin = createAdminClient();

  const [attendanceResult, terms] = await Promise.all([
    admin
      .from("attendance_records")
      .select("status, attendance_registers!inner(status)")
      .eq("student_id", studentId)
      .eq("attendance_registers.status", "submitted"),
    loadStudentResults(admin, studentId),
  ]);

  if (attendanceResult.error) {
    console.error("Unable to load attendance:", attendanceResult.error.message);
  }

  let attendanceValue = "-";
  let attendanceNote = "No data yet";

  if (attendanceResult.error) {
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

  const resultsNote = !terms
    ? "Couldn't load"
    : latest
      ? `${latest.termName}, ${latest.sessionName}`
      : "No published results";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="Attendance rate"
        value={attendanceValue}
        note={attendanceNote}
      />
      <Card
        label="Current average"
        value={latest ? `${latest.average}%` : "-"}
        note={resultsNote}
      />
      <Card
        label="Class position"
        value={latest?.position ? `${latest.position} of ${latest.outOf}` : "-"}
        note={latest ? latest.className : resultsNote}
      />
      <Card label="Fee balance" value="-" note="Not set up yet" />
    </div>
  );
}
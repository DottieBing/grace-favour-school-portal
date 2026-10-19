import { createAdminClient } from "@/lib/supabase/admin";

type Raw = {
  status: "present" | "absent" | "late";
  note: string | null;
  attendance_registers:
    | { attendance_date: string }
    | { attendance_date: string }[]
    | null;
};

function dateOf(value: Raw["attendance_registers"]) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.attendance_date ?? null;
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function StudentAttendanceSection({
  studentId,
}: {
  studentId: string;
}) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("attendance_records")
    .select("status, note, attendance_registers!inner(attendance_date, status)")
    .eq("student_id", studentId)
    .eq("attendance_registers.status", "submitted");

  if (error) {
    console.error("Unable to load attendance:", error.message);

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        We couldn&apos;t load the attendance records. Please refresh the page.
      </div>
    );
  }

  const records = ((data ?? []) as unknown as Raw[])
    .map((item) => ({
      status: item.status,
      note: item.note,
      date: dateOf(item.attendance_registers),
    }))
    .filter((item): item is { status: Raw["status"]; note: string | null; date: string } =>
      Boolean(item.date),
    );

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-900">
          No attendance recorded yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Marks appear here once the class teacher submits a register.
        </p>
      </div>
    );
  }

  const total = records.length;
  const present = records.filter((item) => item.status === "present").length;
  const absent = records.filter((item) => item.status === "absent").length;
  const late = records.filter((item) => item.status === "late").length;
  const rate = Math.round(((present + late) / total) * 100);

  const months = new Map<string, { total: number; attended: number }>();

  for (const item of records) {
    const key = item.date.slice(0, 7);
    const entry = months.get(key) ?? { total: 0, attended: 0 };

    entry.total += 1;
    if (item.status !== "absent") entry.attended += 1;

    months.set(key, entry);
  }

  const monthRows = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));

  const exceptions = records
    .filter((item) => item.status !== "present")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Attendance rate", value: `${rate}%` },
          { label: "Days present", value: String(present) },
          { label: "Days absent", value: String(absent) },
          { label: "Days late", value: String(late) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {card.value}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {total} day{total === 1 ? "" : "s"} recorded
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Attendance by month
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Late counts as attended.
        </p>
        <div className="mt-4 space-y-4">
          {monthRows.map(([key, entry]) => {
            const percent = Math.round((entry.attended / entry.total) * 100);

            return (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    {formatMonth(key)}
                  </span>
                  <span className="text-slate-500">
                    {percent}% · {entry.attended} of {entry.total} days
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#0D5C63]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Recent absences and lateness
        </h2>
        {exceptions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No absences or late arrivals recorded.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {exceptions.map((item) => (
              <li
                key={item.date}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-slate-900">{formatDay(item.date)}</span>
                <span className="flex items-center gap-3">
                  {item.note ? (
                    <span className="text-xs text-slate-500">{item.note}</span>
                  ) : null}
                  <span
                    className={
                      item.status === "absent"
                        ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                        : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                    }
                  >
                    {item.status === "absent" ? "Absent" : "Late"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
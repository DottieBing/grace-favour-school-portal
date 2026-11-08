import { createAdminClient } from "@/lib/supabase/admin";
import { ClassStudents, type Candidate } from "@/components/classes/class-students";

type Raw = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  classes: { name: string } | { name: string }[] | null;
};

const COLUMNS = "id, admission_number, first_name, middle_name, last_name, classes(name)";

function fullName(row: Raw) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

export async function ClassStudentsSection({
  classId,
  className,
  capacity,
  canMove,
}: {
  classId: string;
  className: string;
  capacity: number | null;
  canMove: boolean;
}) {
  const admin = createAdminClient();

  const [members, others] = await Promise.all([
    admin
      .from("students")
      .select(COLUMNS)
      .eq("current_class_id", classId)
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(1000),
    canMove
      ? admin
          .from("students")
          .select(COLUMNS)
          .eq("status", "active")
          .or(`current_class_id.is.null,current_class_id.neq.${classId}`)
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (members.error || others.error) {
    console.error("Unable to load class students:", members.error?.message ?? others.error?.message);

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        We couldn&apos;t load the students. Please refresh the page.
      </div>
    );
  }

  const list = (members.data ?? []) as unknown as Raw[];

  const candidates: Candidate[] = ((others.data ?? []) as unknown as Raw[]).map((row) => {
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;

    return {
      id: row.id,
      name: fullName(row),
      admissionNumber: row.admission_number,
      fromClass: cls?.name ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <details className="rounded-lg border border-slate-200">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
          {list.length} student{list.length === 1 ? "" : "s"} in {className}
          {capacity ? ` (capacity ${capacity})` : ""}
        </summary>
        {list.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">No students yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {list.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-slate-900">{fullName(row)}</span>
                <span className="font-mono text-xs text-slate-500">{row.admission_number}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      {canMove ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900">Add students to {className}</h3>
          <ClassStudents
            classId={classId}
            className={className}
            capacity={capacity}
            memberCount={list.length}
            candidates={candidates}
          />
        </div>
      ) : null}
    </div>
  );
}
import "server-only";

import { getCurrentSession } from "@/lib/academic/current-session";
import { getCurrentTerm } from "@/lib/academic/current-term";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type Scope = {
  classId: string;
  className: string;
  isClassTeacher: boolean;
  subjectIds: string[];
};

/** The active subjects a class takes. */
export async function classSubjectIds(
  admin: Admin,
  classId: string,
): Promise<string[] | null> {
  const links = await admin
    .from("class_subjects")
    .select("subject_id")
    .eq("class_id", classId)
    .eq("is_active", true);

  if (links.error) {
    console.error("Unable to load class subjects:", links.error.message);
    return null;
  }

  const ids = (links.data ?? []).map((item) => item.subject_id as string);

  if (ids.length === 0) return [];

  const subjects = await admin
    .from("subjects")
    .select("id")
    .in("id", ids)
    .eq("is_active", true);

  if (subjects.error) {
    console.error("Unable to load subjects:", subjects.error.message);
    return null;
  }

  return (subjects.data ?? []).map((item) => item.id as string);
}

/** Classes a teacher may score, and which subjects. Class teachers get every subject. */
export async function loadTeacherScopes(
  admin: Admin,
  staffId: string,
  sessionId: string,
): Promise<Scope[] | null> {
  const { data, error } = await admin
    .from("teacher_assignments")
    .select("class_id, subject_id, is_class_teacher")
    .eq("teacher_id", staffId)
    .eq("academic_session_id", sessionId)
    .eq("is_active", true);

  if (error) {
    console.error("Unable to load assignments:", error.message);
    return null;
  }

  const assignments = data ?? [];

  if (assignments.length === 0) return [];

  const classIds = [...new Set(assignments.map((item) => item.class_id as string))];

  const classesResult = await admin
    .from("classes")
    .select("id, name")
    .in("id", classIds)
    .eq("is_active", true)
    .order("level_number", { ascending: true })
    .order("section", { ascending: true, nullsFirst: true });

  if (classesResult.error) {
    console.error("Unable to load classes:", classesResult.error.message);
    return null;
  }

  const scopes: Scope[] = [];

  for (const cls of classesResult.data ?? []) {
    const id = cls.id as string;
    const mine = assignments.filter((item) => item.class_id === id);
    const isClassTeacher = mine.some((item) => item.is_class_teacher);
    const all = await classSubjectIds(admin, id);

    if (!all) return null;

    const subjectIds = isClassTeacher
      ? all
      : [...new Set(mine.map((item) => item.subject_id as string))].filter((item) =>
          all.includes(item),
        );

    scopes.push({ classId: id, className: cls.name as string, isClassTeacher, subjectIds });
  }

  return scopes;
}

export type ScopeResult =
  | { ok: true; staffId: string; scope: Scope; termId: string; termLabel: string }
  | { ok: false; status: number; message: string };

/** What this signed-in teacher may score in one class, this term. */
export async function getTeacherScope(
  admin: Admin,
  userId: string,
  classId: string,
): Promise<ScopeResult> {
  const [session, term] = await Promise.all([getCurrentSession(), getCurrentTerm()]);

  if (!session || !term) {
    return { ok: false, status: 409, message: "No current term is set. Contact the administrator." };
  }

  const staff = await admin.from("staff").select("id").eq("user_id", userId).maybeSingle();

  if (staff.error) {
    console.error("Unable to load staff record:", staff.error.message);
    return { ok: false, status: 500, message: "Unable to verify your account." };
  }

  if (!staff.data) {
    return { ok: false, status: 403, message: "Your staff record wasn't found." };
  }

  const scopes = await loadTeacherScopes(admin, staff.data.id as string, session.id);

  if (!scopes) {
    return { ok: false, status: 500, message: "Unable to verify your classes." };
  }

  const scope = scopes.find((item) => item.classId === classId);

  if (!scope) {
    return { ok: false, status: 403, message: "You don't teach this class." };
  }

  return {
    ok: true,
    staffId: staff.data.id as string,
    scope,
    termId: term.id,
    termLabel: `${term.sessionName} · ${term.termName}`,
  };
}
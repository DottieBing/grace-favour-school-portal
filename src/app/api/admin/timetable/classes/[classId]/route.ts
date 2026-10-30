import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/academic/current-session";
import { getSchoolProfile } from "@/lib/settings/school";
import { loadClassSchedule } from "@/lib/timetable/schedule";
import { DAY_NAMES, appliesOn } from "@/lib/timetable/time";
import { cellKey } from "@/lib/timetable/types";
import { createAdminClient } from "@/lib/supabase/admin";

const cellSchema = z.object({
  periodId: z.uuid(),
  day: z.number().int().min(1).max(7),
  subjectId: z.uuid().nullable(),
  label: z.string().trim().max(60, "Labels can be at most 60 characters."),
  teacherId: z.uuid().nullable(),
  room: z.string().trim().max(40, "Rooms can be at most 40 characters."),
});

const schema = z.object({ cells: z.array(cellSchema).max(500) });

export async function PUT(
  request: Request,
  context: { params: Promise<{ classId: string }> },
) {
  const access = await getAdminAccess("timetable", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { classId } = await context.params;

  if (!z.uuid().safeParse(classId).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let cells: z.infer<typeof cellSchema>[];

  try {
    const body: unknown = await request.json();
    cells = schema.parse(body).cells;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid timetable.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [session, profile] = await Promise.all([
    getCurrentSession(),
    getSchoolProfile(),
  ]);

  if (!session) {
    return NextResponse.json(
      { error: "Set a current term before building timetables." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("id, is_active")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    console.error("Unable to load the class:", classError.message);
    return NextResponse.json({ error: "Unable to save the timetable." }, { status: 500 });
  }

  if (!cls || !cls.is_active) {
    return NextResponse.json({ error: "Choose an active class." }, { status: 400 });
  }

  const schedule = await loadClassSchedule(admin, classId);

  if (!schedule) {
    return NextResponse.json({ error: "Unable to load the schedule." }, { status: 500 });
  }

  const periods = new Map(schedule.periods.map((item) => [item.id, item]));

  // The subjects this class takes and who teaches each this session.
  const [linksResult, assignmentsResult] = await Promise.all([
    admin
      .from("class_subjects")
      .select("subject_id")
      .eq("class_id", classId)
      .eq("is_active", true),
    admin
      .from("teacher_assignments")
      .select("subject_id, teacher_id")
      .eq("class_id", classId)
      .eq("academic_session_id", session.id)
      .eq("is_active", true),
  ]);

  if (linksResult.error || assignmentsResult.error) {
    console.error(
      "Unable to load class subjects:",
      linksResult.error?.message ?? assignmentsResult.error?.message,
    );
    return NextResponse.json({ error: "Unable to save the timetable." }, { status: 500 });
  }

  const classSubjects = new Set((linksResult.data ?? []).map((item) => item.subject_id as string));
  const assigned = new Map(
    (assignmentsResult.data ?? []).map((item) => [
      item.subject_id as string,
      item.teacher_id as string,
    ]),
  );

  const explicitTeachers = [
    ...new Set(cells.map((item) => item.teacherId).filter((id): id is string => id !== null)),
  ];

  const validTeachers = new Set<string>();

  if (explicitTeachers.length > 0) {
    const { data, error } = await admin
      .from("staff")
      .select("id, staff_type, is_active")
      .in("id", explicitTeachers);

    if (error) {
      console.error("Unable to verify teachers:", error.message);
      return NextResponse.json({ error: "Unable to save the timetable." }, { status: 500 });
    }

    for (const row of data ?? []) {
      if (row.staff_type === "teaching" && row.is_active) validTeachers.add(row.id as string);
    }
  }

  const seen = new Set<string>();
  const cleaned: {
    period_id: string;
    day: number;
    subject_id: string;
    label: string;
    teacher_id: string;
    room: string;
  }[] = [];

  for (const cell of cells) {
    const period = periods.get(cell.periodId);
    const where = `${DAY_NAMES[cell.day]}${period ? `, ${period.name}` : ""}`;

    if (!period) {
      return NextResponse.json(
        { error: "A slot doesn't belong to this class's schedule. Refresh the page." },
        { status: 409 },
      );
    }

    if (period.isBreak) {
      return NextResponse.json({ error: `${where} is a break and can't hold a lesson.` }, { status: 400 });
    }

    if (!profile.timetableDays.includes(cell.day) || !appliesOn(period.days, cell.day)) {
      return NextResponse.json({ error: `${where} isn't a teaching slot.` }, { status: 400 });
    }

    const key = cellKey(cell.periodId, cell.day);

    if (seen.has(key)) {
      return NextResponse.json({ error: `${where} was sent twice. Refresh and try again.` }, { status: 400 });
    }

    seen.add(key);

    if (!cell.subjectId && cell.label === "") {
      return NextResponse.json({ error: `${where} needs a subject or a label.` }, { status: 400 });
    }

    if (cell.subjectId && !classSubjects.has(cell.subjectId)) {
      return NextResponse.json(
        { error: `${where}: this class doesn't take that subject.` },
        { status: 400 },
      );
    }

    if (cell.teacherId && !validTeachers.has(cell.teacherId)) {
      return NextResponse.json(
        { error: `${where}: choose an active teacher.` },
        { status: 400 },
      );
    }

    cleaned.push({
      period_id: cell.periodId,
      day: cell.day,
      subject_id: cell.subjectId ?? "",
      label: cell.subjectId ? "" : cell.label,
      teacher_id:
        cell.teacherId ?? (cell.subjectId ? (assigned.get(cell.subjectId) ?? "") : ""),
      room: cell.room,
    });
  }

  const { error } = await admin.rpc("save_class_timetable", {
    p_session_id: session.id,
    p_class_id: classId,
    p_cells: cleaned,
    p_check_clash: profile.teacherClashCheck,
  });

  if (error) {
    if (error.code === "TT001") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Saving the timetable failed:", error.message);
    return NextResponse.json({ error: "Unable to save the timetable." }, { status: 500 });
  }

  return NextResponse.json({ message: "Timetable saved." });
}
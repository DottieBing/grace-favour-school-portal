import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  subjectIds: z.array(z.uuid()).max(60),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let wanted: string[];

  try {
    const body: unknown = await request.json();
    wanted = [...new Set(schema.parse(body).subjectIds)];
  } catch {
    return NextResponse.json(
      { error: "The request must include a list of subject ids." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (classError) {
    console.error("Unable to load class:", classError.message);
    return NextResponse.json(
      { error: "Unable to load the class." },
      { status: 500 },
    );
  }

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: existing, error: existingError } = await admin
    .from("class_subjects")
    .select("subject_id, is_active")
    .eq("class_id", id);

  if (existingError) {
    console.error("Unable to load class subjects:", existingError.message);
    return NextResponse.json(
      { error: "Unable to load the class's subjects." },
      { status: 500 },
    );
  }

  const currentlyActive = new Set(
    (existing ?? [])
      .filter((row) => row.is_active)
      .map((row) => row.subject_id as string),
  );
  const wantedSet = new Set(wanted);

  const toAdd = wanted.filter((subjectId) => !currentlyActive.has(subjectId));
  const toRemove = [...currentlyActive].filter(
    (subjectId) => !wantedSet.has(subjectId),
  );

  if (toAdd.length > 0) {
    const { data: found, error: subjectError } = await admin
      .from("subjects")
      .select("id, is_active")
      .in("id", toAdd);

    if (subjectError) {
      console.error("Unable to verify subjects:", subjectError.message);
      return NextResponse.json(
        { error: "Unable to verify the subjects." },
        { status: 500 },
      );
    }

    if (
      !found ||
      found.length !== toAdd.length ||
      found.some((subject) => !subject.is_active)
    ) {
      return NextResponse.json(
        { error: "One or more subjects are unavailable. Refresh and try again." },
        { status: 400 },
      );
    }
  }

  if (toRemove.length > 0) {
    const { count, error: assignmentError } = await admin
      .from("teacher_assignments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .eq("is_active", true)
      .in("subject_id", toRemove);

    if (assignmentError) {
      console.error("Unable to check assignments:", assignmentError.message);
      return NextResponse.json(
        { error: "Unable to check teacher assignments." },
        { status: 500 },
      );
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "A teacher is still assigned to a subject you're removing. Remove that assignment first.",
        },
        { status: 409 },
      );
    }
  }

  if (toAdd.length > 0) {
    const { error: upsertError } = await admin.from("class_subjects").upsert(
      toAdd.map((subjectId) => ({
        class_id: id,
        subject_id: subjectId,
        is_active: true,
      })),
      { onConflict: "class_id,subject_id" },
    );

    if (upsertError) {
      console.error("Adding class subjects failed:", upsertError.message);
      return NextResponse.json(
        { error: "Unable to save the subjects." },
        { status: 500 },
      );
    }
  }

  if (toRemove.length > 0) {
    const { error: removeError } = await admin
      .from("class_subjects")
      .update({ is_active: false })
      .eq("class_id", id)
      .in("subject_id", toRemove);

    if (removeError) {
      console.error("Removing class subjects failed:", removeError.message);
      return NextResponse.json(
        { error: "Unable to save the subjects." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Subjects saved." });
}
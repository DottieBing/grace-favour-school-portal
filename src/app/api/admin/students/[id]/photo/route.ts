import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType } from "@/lib/uploads/image-type";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
  }

  let file: File | null = null;

  try {
    const form = await request.formData();
    const value = form.get("photo");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json(
      { error: "The upload could not be read." },
      { status: 400 },
    );
  }

  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "Choose a photo to upload." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "The photo must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected) {
    return NextResponse.json(
      { error: "Upload a JPG, PNG or WebP image." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: student, error: loadError } = await admin
    .from("students")
    .select("id, photo_path")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load student:", loadError.message);
    return NextResponse.json(
      { error: "Unable to load the student." },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const newPath = `${id}/${randomUUID()}.${detected.ext}`;

  const { error: uploadError } = await admin.storage
    .from("student-photos")
    .upload(newPath, buffer, { contentType: detected.mime, upsert: false });

  if (uploadError) {
    console.error("Photo upload failed:", uploadError.message);
    return NextResponse.json(
      { error: "Unable to upload the photo." },
      { status: 500 },
    );
  }

  const { error: updateError } = await admin
    .from("students")
    .update({ photo_path: newPath, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("Photo path update failed:", updateError.message);
    await admin.storage.from("student-photos").remove([newPath]);

    return NextResponse.json(
      { error: "Unable to save the photo." },
      { status: 500 },
    );
  }

  if (student.photo_path) {
    const { error: removeError } = await admin.storage
      .from("student-photos")
      .remove([student.photo_path as string]);

    if (removeError) {
      console.error("Old photo cleanup failed:", removeError.message);
    }
  }

  return NextResponse.json({ message: "Photo updated." });
}
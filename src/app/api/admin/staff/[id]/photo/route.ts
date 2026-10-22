import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;

// Checks the file's real contents, not just the type the browser claims.
function detectImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

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
    return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
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

  const { data: staff, error: loadError } = await admin
    .from("staff")
    .select("id, photo_path")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load staff record:", loadError.message);
    return NextResponse.json(
      { error: "Unable to load the staff record." },
      { status: 500 },
    );
  }

  if (!staff) {
    return NextResponse.json(
      { error: "Staff record not found." },
      { status: 404 },
    );
  }

  const newPath = `${id}/${randomUUID()}.${detected.ext}`;

  const { error: uploadError } = await admin.storage
    .from("staff-photos")
    .upload(newPath, buffer, { contentType: detected.mime, upsert: false });

  if (uploadError) {
    console.error("Photo upload failed:", uploadError.message);
    return NextResponse.json(
      { error: "Unable to upload the photo." },
      { status: 500 },
    );
  }

  const { error: updateError } = await admin
    .from("staff")
    .update({ photo_path: newPath })
    .eq("id", id);

  if (updateError) {
    console.error("Photo path update failed:", updateError.message);
    await admin.storage.from("staff-photos").remove([newPath]);

    return NextResponse.json(
      { error: "Unable to save the photo." },
      { status: 500 },
    );
  }

  // Best effort: remove the previous photo so old files don't pile up.
  if (staff.photo_path) {
    const { error: removeError } = await admin.storage
      .from("staff-photos")
      .remove([staff.photo_path]);

    if (removeError) {
      console.error("Old photo cleanup failed:", removeError.message);
    }
  }

  return NextResponse.json({ message: "Photo updated." });
}
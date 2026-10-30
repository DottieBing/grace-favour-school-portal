import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType } from "@/lib/uploads/image-type";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let file: File | null = null;

  try {
    const form = await request.formData();
    const value = form.get("logo");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "The upload could not be read." }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Choose a logo to upload." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "The logo must be 2 MB or smaller." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected) {
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: current, error: loadError } = await admin
    .from("school_settings")
    .select("logo_path")
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load settings:", loadError.message);
    return NextResponse.json({ error: "Unable to save the logo." }, { status: 500 });
  }

  const path = `logo/${randomUUID()}.${detected.ext}`;

  const { error: uploadError } = await admin.storage
    .from("school-assets")
    .upload(path, buffer, { contentType: detected.mime, upsert: false });

  if (uploadError) {
    console.error("Logo upload failed:", uploadError.message);
    return NextResponse.json({ error: "Unable to upload the logo." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("school_settings")
    .upsert({ id: true, logo_path: path, updated_at: new Date().toISOString() });

  if (updateError) {
    console.error("Saving the logo failed:", updateError.message);
    await admin.storage.from("school-assets").remove([path]);
    return NextResponse.json({ error: "Unable to save the logo." }, { status: 500 });
  }

  const old = current?.logo_path as string | null | undefined;

  if (old) {
    await admin.storage.from("school-assets").remove([old]);
  }

  return NextResponse.json({ message: "Logo updated." });
}
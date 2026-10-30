import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Sends the browser to the school's uploaded logo, or the file in /public.
export async function GET(request: Request) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("school_settings")
    .select("logo_path")
    .maybeSingle();

  const path = data?.logo_path as string | null | undefined;

  const target = path
    ? admin.storage.from("school-assets").getPublicUrl(path).data.publicUrl
    : "/logo.png";

  return NextResponse.redirect(new URL(target, request.url), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
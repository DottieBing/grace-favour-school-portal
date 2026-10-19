import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must sign in first." },
      { status: 401 },
    );
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    console.error("Unable to read roles:", roleError.message);
    return NextResponse.json(
      { error: "Unable to check your account." },
      { status: 500 },
    );
  }

  const names = (roles ?? []).map((item) => item.role as string);

  // Pages and API routes still do their own checks. This only picks the landing page.
  const path = names.includes("super_admin")
    ? "/admin"
    : names.includes("teacher")
      ? "/teacher"
      : names.length > 0
        ? "/portal"
        : "/unauthorized";

  return NextResponse.json(
    { path },
    { headers: { "Cache-Control": "no-store" } },
  );
}
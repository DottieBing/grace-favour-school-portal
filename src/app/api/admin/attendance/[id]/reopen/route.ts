import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid register id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("reopen_attendance", {
    p_register_id: id,
    p_actor: access.user.id,
  });

  if (error) {
    if (error.code === "P0002") {
      return NextResponse.json({ error: "Register not found." }, { status: 404 });
    }

    if (error.code === "AT002") {
      return NextResponse.json(
        { error: "Only a submitted register can be reopened." },
        { status: 409 },
      );
    }

    console.error("Reopening the register failed:", error.message);

    return NextResponse.json(
      { error: "Unable to reopen the register." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Register reopened." });
}
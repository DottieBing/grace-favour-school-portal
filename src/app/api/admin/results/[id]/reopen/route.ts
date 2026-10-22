import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("results", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid sheet id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("reopen_results", {
    p_sheet_id: id,
    p_actor: access.user.id,
  });

  if (error) {
    if (error.code === "P0002") {
      return NextResponse.json({ error: "Sheet not found." }, { status: 404 });
    }

    if (error.code === "RS002") {
      return NextResponse.json(
        { error: "Only a submitted sheet can be reopened." },
        { status: 409 },
      );
    }

    console.error("Reopening results failed:", error.message);

    return NextResponse.json(
      { error: "Unable to reopen the results." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Results reopened." });
}
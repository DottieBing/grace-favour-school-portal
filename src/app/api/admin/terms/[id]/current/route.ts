import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("sessions", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid term id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("set_current_term", { p_term_id: id });

  if (error) {
    if (error.code === "P0002") {
      return NextResponse.json({ error: "Term not found." }, { status: 404 });
    }

    console.error("Setting the current term failed:", error.message);

    return NextResponse.json(
      { error: "Unable to change the current term." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Current term updated." });
}
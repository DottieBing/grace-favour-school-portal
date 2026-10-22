import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  sheetIds: z.array(z.uuid()).min(1, "Choose at least one sheet.").max(300),
});

export async function POST(request: Request) {
  const access = await getAdminAccess("results", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let sheetIds: string[];

  try {
    const body: unknown = await request.json();
    sheetIds = [...new Set(schema.parse(body).sheetIds)];
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("publish_results", {
    p_sheet_ids: sheetIds,
    p_actor: access.user.id,
  });

  if (error) {
    if (error.code === "RS004") {
      return NextResponse.json(
        { error: "Set up a grade scale on the Grading page first." },
        { status: 409 },
      );
    }

    console.error("Publishing results failed:", error.message);

    return NextResponse.json(
      { error: "Unable to publish the results. Nothing was published." },
      { status: 500 },
    );
  }

  const published = typeof data === "number" ? data : 0;

  return NextResponse.json({
    published,
    skipped: sheetIds.length - published,
  });
}
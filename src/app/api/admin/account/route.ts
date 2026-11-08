import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminSession } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
});

export async function PUT(request: Request) {
  // Any signed-in admin login may change their own name. No area tick is needed.
  const session = await getAdminSession();

  if (!session.ok) return accessErrorResponse(session);

  let fullName: string;

  try {
    fullName = schema.parse(await request.json()).fullName;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid name.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);

  if (error) {
    console.error("Updating the name failed:", error.message);
    return NextResponse.json({ error: "Unable to save your name." }, { status: 500 });
  }

  return NextResponse.json({ message: "Name saved." });
}
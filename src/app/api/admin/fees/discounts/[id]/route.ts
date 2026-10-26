import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ isActive: z.literal(false) });

// "Removing" a discount keeps the row, so the history stays.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("fees", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid discount id." }, { status: 400 });
  }

  try {
    const body: unknown = await request.json();
    schema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Discounts can only be removed here." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("fee_discounts")
    .update({ removed_at: new Date().toISOString(), removed_by: access.user.id })
    .eq("id", id)
    .is("removed_at", null)
    .select("id");

  if (error) {
    console.error("Discount removal failed:", error.message);
    return NextResponse.json(
      { error: "Unable to remove the discount." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Discount not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Discount removed." });
}
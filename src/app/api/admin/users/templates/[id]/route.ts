import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("permission_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Template deletion failed:", error.message);
    return NextResponse.json(
      { error: "Unable to delete the template." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Template deleted." });
}
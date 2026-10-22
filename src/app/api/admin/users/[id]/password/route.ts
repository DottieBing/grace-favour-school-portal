import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { generateStudentPassword } from "@/lib/students/password";
import { checkAdminUser } from "@/lib/users/target";
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
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const problem = await checkAdminUser(admin, id, access.user.id);

  if (problem) {
    return NextResponse.json({ error: problem.message }, { status: problem.status });
  }

  const password = generateStudentPassword(14);

  const { error } = await admin.auth.admin.updateUserById(id, { password });

  if (error) {
    console.error("Password reset failed:", error.message);
    return NextResponse.json(
      { error: "Unable to reset the password." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { password },
    { headers: { "Cache-Control": "no-store" } },
  );
}
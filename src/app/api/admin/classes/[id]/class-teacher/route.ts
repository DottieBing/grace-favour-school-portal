import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/academic/current-session";

const schema = z.object({ teacherId: z.uuid().nullable() });

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("classes", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let teacherId: string | null;

  try {
    const body: unknown = await request.json();
    teacherId = schema.parse(body).teacherId;
  } catch {
    return NextResponse.json(
      { error: "The request must include a teacherId, or null to clear it." },
      { status: 400 },
    );
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { error: "Set a current term first." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("set_class_teacher", {
    p_class_id: id,
    p_session_id: session.id,
    p_teacher_id: teacherId,
  });

  if (error) {
    if (error.code === "P0002") {
      return NextResponse.json(
        {
          error:
            "That teacher isn't assigned to any subject in this class yet.",
        },
        { status: 400 },
      );
    }

    console.error("Setting the class teacher failed:", error.message);

    return NextResponse.json(
      { error: "Unable to change the class teacher." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Class teacher updated." });
}
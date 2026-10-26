import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  termId: z.uuid(),
  classId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const access = await getAdminAccess("fees", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Choose a term, and optionally a class." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: term, error: termError } = await admin
    .from("academic_terms")
    .select("id")
    .eq("id", input.termId)
    .maybeSingle();

  if (termError) {
    console.error("Unable to load term:", termError.message);
    return NextResponse.json({ error: "Unable to load the term." }, { status: 500 });
  }

  if (!term) {
    return NextResponse.json({ error: "Term not found." }, { status: 404 });
  }

  let classIds: string[];

  if (input.classId) {
    classIds = [input.classId];
  } else {
    const { data, error } = await admin
      .from("classes")
      .select("id")
      .eq("is_active", true);

    if (error) {
      console.error("Unable to load classes:", error.message);
      return NextResponse.json(
        { error: "Unable to load the classes." },
        { status: 500 },
      );
    }

    classIds = (data ?? []).map((item) => item.id as string);
  }

  if (classIds.length === 0) {
    return NextResponse.json({ error: "There are no classes to charge." }, { status: 400 });
  }

  const { data, error } = await admin.rpc("generate_fee_charges", {
    p_term_id: input.termId,
    p_class_ids: classIds,
  });

  if (error) {
    console.error("Generating charges failed:", error.message);
    return NextResponse.json(
      { error: "Unable to generate the charges. Nothing was changed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ created: typeof data === "number" ? data : 0 });
}
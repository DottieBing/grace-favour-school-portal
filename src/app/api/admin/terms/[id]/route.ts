import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  startDate: z.string().date("Enter a valid start date."),
  endDate: z.string().date("Enter a valid end date."),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid term id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid dates.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (input.endDate <= input.startDate) {
    return NextResponse.json(
      { error: "The end date must be after the start date." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: term, error: termError } = await admin
    .from("academic_terms")
    .select("id, session_id, term_number")
    .eq("id", id)
    .maybeSingle();

  if (termError) {
    console.error("Unable to load term:", termError.message);
    return NextResponse.json(
      { error: "Unable to load the term." },
      { status: 500 },
    );
  }

  if (!term) {
    return NextResponse.json({ error: "Term not found." }, { status: 404 });
  }

  const { data: siblings, error: siblingError } = await admin
    .from("academic_terms")
    .select("term_number, start_date, end_date")
    .eq("session_id", term.session_id);

  if (siblingError || !siblings) {
    console.error("Unable to load sibling terms:", siblingError?.message);
    return NextResponse.json(
      { error: "Unable to check the other terms." },
      { status: 500 },
    );
  }

  const previous = siblings.find(
    (item) => item.term_number === term.term_number - 1,
  );
  const next = siblings.find(
    (item) => item.term_number === term.term_number + 1,
  );

  if (previous && input.startDate <= previous.end_date) {
    return NextResponse.json(
      { error: "This term must start after the previous term ends." },
      { status: 400 },
    );
  }

  if (next && input.endDate >= next.start_date) {
    return NextResponse.json(
      { error: "This term must end before the next term starts." },
      { status: 400 },
    );
  }

  const { error: updateError } = await admin
    .from("academic_terms")
    .update({ start_date: input.startDate, end_date: input.endDate })
    .eq("id", id);

  if (updateError) {
    console.error("Term update failed:", updateError.message);
    return NextResponse.json(
      { error: "Unable to save the dates." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Term dates updated." });
}
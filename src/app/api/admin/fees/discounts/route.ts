import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { amountSchema } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  studentId: z.uuid(),
  termId: z.uuid(),
  amount: amountSchema,
  reason: z
    .string()
    .trim()
    .min(3, "Give a reason for the discount.")
    .max(200, "The reason can be at most 200 characters."),
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
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid discount.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const [chargeResult, existingResult] = await Promise.all([
    admin
      .from("fee_charges")
      .select("total")
      .eq("student_id", input.studentId)
      .eq("term_id", input.termId)
      .maybeSingle(),
    admin
      .from("fee_discounts")
      .select("amount")
      .eq("student_id", input.studentId)
      .eq("term_id", input.termId)
      .is("removed_at", null),
  ]);

  if (chargeResult.error || existingResult.error) {
    console.error(
      "Unable to check the charge:",
      chargeResult.error?.message ?? existingResult.error?.message,
    );
    return NextResponse.json(
      { error: "Unable to check the student's charge." },
      { status: 500 },
    );
  }

  if (!chargeResult.data) {
    return NextResponse.json(
      { error: "This student has no charge for that term." },
      { status: 409 },
    );
  }

  const already = (existingResult.data ?? []).reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  if (already + input.amount > Number(chargeResult.data.total) + 0.001) {
    return NextResponse.json(
      { error: "Discounts for that term can't be more than the term's charge." },
      { status: 400 },
    );
  }

  const { error } = await admin.from("fee_discounts").insert({
    student_id: input.studentId,
    term_id: input.termId,
    amount: input.amount,
    reason: input.reason,
    created_by: access.user.id,
  });

  if (error) {
    console.error("Discount creation failed:", error.message);
    return NextResponse.json(
      { error: "Unable to save the discount." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Discount added." }, { status: 201 });
}
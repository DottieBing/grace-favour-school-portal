import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { todayInSchool } from "@/lib/attendance/dates";
import { METHODS, amountSchema } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  studentId: z.uuid(),
  amount: amountSchema,
  paidOn: z.string().date("Enter a valid payment date."),
  method: z.enum(METHODS),
  reference: z.string().trim().max(80, "The reference can be at most 80 characters."),
  note: z.string().trim().max(300, "The note can be at most 300 characters."),
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
        ? (error.issues[0]?.message ?? "Invalid payment.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (input.paidOn > todayInSchool()) {
    return NextResponse.json(
      { error: "The payment date can't be in the future." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("record_office_payment", {
    p_student_id: input.studentId,
    p_actor: access.user.id,
    p_amount: input.amount,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_reference: input.reference,
    p_note: input.note,
  });

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    console.error("Recording the payment failed:", error.message);

    return NextResponse.json(
      { error: "Unable to record the payment." },
      { status: 500 },
    );
  }

  const result = data as { id: string; receipt_number: string };

  return NextResponse.json(
    { id: result.id, receiptNumber: result.receipt_number },
    { status: 201 },
  );
}
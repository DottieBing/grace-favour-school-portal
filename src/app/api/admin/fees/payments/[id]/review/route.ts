import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { amountSchema } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["verify", "reject", "reverse"]),
  amount: amountSchema.optional(),
  reason: z.string().trim().max(300, "The reason can be at most 300 characters.").optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("fees", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (input.action !== "verify" && (input.reason ?? "").length < 3) {
    return NextResponse.json({ error: "Give a reason." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("review_payment", {
    p_payment_id: id,
    p_actor: access.user.id,
    p_action: input.action,
    p_amount: input.action === "verify" ? (input.amount ?? null) : null,
    p_reason: input.action === "verify" ? null : (input.reason ?? null),
  });

  if (error) {
    if (error.code === "P0002") {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (error.code === "FE001") {
      return NextResponse.json(
        { error: "This payment has already been handled. Refresh the page." },
        { status: 409 },
      );
    }

    console.error("Reviewing the payment failed:", error.message);

    return NextResponse.json(
      { error: "Unable to update the payment." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "Payment updated.",
    receiptNumber: typeof data === "string" ? data : null,
  });
}
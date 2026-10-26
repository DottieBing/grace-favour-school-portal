import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { amountSchema } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  classId: z.uuid(),
  termId: z.uuid(),
  amounts: z
    .array(z.object({ itemId: z.uuid(), amount: amountSchema.nullable() }))
    .max(50),
});

export async function PUT(request: Request) {
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
        ? (error.issues[0]?.message ?? "Invalid fees.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const chosen = input.amounts.filter(
    (item): item is { itemId: string; amount: number } => item.amount !== null,
  );
  const ids = [...new Set(chosen.map((item) => item.itemId))];

  if (ids.length !== chosen.length) {
    return NextResponse.json(
      { error: "An item was sent twice. Refresh the page and try again." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const [classResult, termResult] = await Promise.all([
    admin.from("classes").select("id, is_active").eq("id", input.classId).maybeSingle(),
    admin.from("academic_terms").select("id").eq("id", input.termId).maybeSingle(),
  ]);

  if (classResult.error || termResult.error) {
    console.error(
      "Unable to load records:",
      classResult.error?.message ?? termResult.error?.message,
    );
    return NextResponse.json(
      { error: "Unable to load the records." },
      { status: 500 },
    );
  }

  if (!classResult.data || !classResult.data.is_active || !termResult.data) {
    return NextResponse.json(
      { error: "Choose an active class and a valid term." },
      { status: 400 },
    );
  }

  if (ids.length > 0) {
    const { data: found, error: itemsError } = await admin
      .from("fee_items")
      .select("id, is_active")
      .in("id", ids);

    if (itemsError) {
      console.error("Unable to verify items:", itemsError.message);
      return NextResponse.json(
        { error: "Unable to verify the fee items." },
        { status: 500 },
      );
    }

    if (
      !found ||
      found.length !== ids.length ||
      found.some((item) => !item.is_active)
    ) {
      return NextResponse.json(
        { error: "One or more fee items are unavailable. Refresh and try again." },
        { status: 400 },
      );
    }
  }

  const { error } = await admin.rpc("save_fee_structure", {
    p_class_id: input.classId,
    p_term_id: input.termId,
    p_amounts: chosen.map((item) => ({
      item_id: item.itemId,
      amount: item.amount,
    })),
  });

  if (error) {
    console.error("Saving the structure failed:", error.message);
    return NextResponse.json(
      { error: "Unable to save the fees." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Fees saved." });
}
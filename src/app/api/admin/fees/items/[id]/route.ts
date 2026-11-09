import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfirm } from "@/lib/delete/confirm";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the item name.").max(60).optional(),
  description: z
    .string()
    .trim()
    .max(200, "The description can be at most 200 characters.")
    .transform((value) => (value === "" ? null : value))
    .optional(),
  isActive: z.boolean().optional(),
});

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
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const update: Record<string, string | boolean | null> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "There is nothing to change." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("fee_items")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A fee item with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Fee item update failed:", error.message);

    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Item updated." });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("fees", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  const confirm = await readConfirm(request);
  const admin = createAdminClient();

  const found = await admin.from("fee_items").select("name").eq("id", id).maybeSingle();

  if (found.error) {
    console.error("Unable to load fee item:", found.error.message);
    return NextResponse.json({ error: "Unable to delete the item." }, { status: 500 });
  }

  if (!found.data) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  if (confirm !== found.data.name) {
    return NextResponse.json({ error: "Type the item name exactly to confirm." }, { status: 400 });
  }

  const { data, error } = await admin.rpc("delete_fee_item", { p_item_id: id });

  if (error || data !== "ok") {
    if (error) console.error("Deleting the fee item failed:", error.message);
    return NextResponse.json({ error: "Unable to delete the item." }, { status: 500 });
  }

  return NextResponse.json({ message: "Item deleted." });
}
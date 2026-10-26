import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  bankName: z.string().trim().min(2, "Enter the bank name.").max(80),
  accountName: z.string().trim().min(2, "Enter the account name.").max(120),
  accountNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6,20}$/, "Enter the account number (digits only).")),
  note: z
    .string()
    .trim()
    .max(300, "The note can be at most 300 characters.")
    .transform((value) => (value === "" ? null : value)),
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
        ? (error.issues[0]?.message ?? "Invalid bank details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("fee_settings").upsert({
    id: true,
    bank_name: input.bankName,
    account_name: input.accountName,
    account_number: input.accountNumber,
    note: input.note,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Saving bank details failed:", error.message);
    return NextResponse.json(
      { error: "Unable to save the bank details." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Bank details saved." });
}
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { todayInSchool } from "@/lib/attendance/dates";
import { amountSchema } from "@/lib/fees/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectReceiptType } from "@/lib/uploads/receipt-type";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_WAITING = 5;

export async function POST(request: Request) {
  const access = await getAccess("student");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "The upload could not be read." },
      { status: 400 },
    );
  }

  const amount = amountSchema.safeParse(Number(form.get("amount")));

  if (!amount.success) {
    return NextResponse.json(
      { error: amount.error.issues[0]?.message ?? "Enter a valid amount." },
      { status: 400 },
    );
  }

  const paidOn = z.string().date().safeParse(form.get("paidOn"));

  if (!paidOn.success) {
    return NextResponse.json(
      { error: "Enter the date you paid." },
      { status: 400 },
    );
  }

  if (paidOn.data > todayInSchool()) {
    return NextResponse.json(
      { error: "The payment date can't be in the future." },
      { status: 400 },
    );
  }

  const referenceValue = form.get("reference");
  const reference =
    typeof referenceValue === "string" ? referenceValue.trim().slice(0, 80) : "";

  const value = form.get("receipt");
  const file = value instanceof File ? value : null;

  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "Attach your receipt (an image or a PDF)." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "The receipt must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectReceiptType(buffer);

  if (!detected) {
    return NextResponse.json(
      { error: "Upload a JPG, PNG, WebP or PDF file." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id, status")
    .eq("user_id", access.user.id)
    .maybeSingle();

  if (studentError) {
    console.error("Unable to load the student:", studentError.message);
    return NextResponse.json(
      { error: "Unable to verify your account." },
      { status: 500 },
    );
  }

  if (!student || student.status !== "active") {
    return NextResponse.json({ error: "Account not found." }, { status: 403 });
  }

  const { count, error: countError } = await admin
    .from("fee_payments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .eq("status", "reviewing");

  if (countError) {
    console.error("Unable to count claims:", countError.message);
    return NextResponse.json(
      { error: "Unable to submit your receipt." },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= MAX_WAITING) {
    return NextResponse.json(
      {
        error:
          "You already have several receipts waiting for review. Please wait for the school to review them.",
      },
      { status: 409 },
    );
  }

  const path = `${student.id}/${randomUUID()}.${detected.ext}`;

  const { error: uploadError } = await admin.storage
    .from("fee-receipts")
    .upload(path, buffer, { contentType: detected.mime, upsert: false });

  if (uploadError) {
    console.error("Receipt upload failed:", uploadError.message);
    return NextResponse.json(
      { error: "Unable to upload the receipt." },
      { status: 500 },
    );
  }

  const { data: payment, error: insertError } = await admin
    .from("fee_payments")
    .insert({
      student_id: student.id,
      amount: amount.data,
      paid_on: paidOn.data,
      method: "bank_transfer",
      reference: reference === "" ? null : reference,
      source: "parent",
      status: "reviewing",
      receipt_path: path,
      submitted_by: access.user.id,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    console.error("Saving the claim failed:", insertError?.message);
    await admin.storage.from("fee-receipts").remove([path]);

    return NextResponse.json(
      { error: "Unable to submit your receipt." },
      { status: 500 },
    );
  }

  const { error: eventError } = await admin.from("fee_events").insert({
    payment_id: payment.id,
    action: "submitted",
    actor_id: access.user.id,
  });

  if (eventError) {
    console.error("Recording the claim event failed:", eventError.message);
  }

  return NextResponse.json({ message: "Receipt submitted." }, { status: 201 });
}
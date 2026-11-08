import "server-only";

import { createHmac, randomInt } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type Purpose = "verify_email" | "reset_password";

export const CODE_MINUTES = 10;
const MAX_PER_HOUR = 3;

function hashCode(purpose: Purpose, studentId: string, email: string, code: string) {
  const secret = process.env.EMAIL_CODE_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("EMAIL_CODE_SECRET is missing or too short.");
  }

  return createHmac("sha256", secret)
    .update(`${purpose}|${studentId}|${email.toLowerCase()}|${code}`)
    .digest("hex");
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: "rate" | "error" };

/** Creates a fresh 6-digit code and retires any earlier unused one. */
export async function issueCode(
  admin: Admin,
  args: { purpose: Purpose; studentId: string; email: string },
): Promise<IssueResult> {
  try {
    const since = new Date(Date.now() - 3_600_000).toISOString();

    const recent = await admin
      .from("email_codes")
      .select("id", { count: "exact", head: true })
      .eq("student_id", args.studentId)
      .eq("purpose", args.purpose)
      .gte("created_at", since);

    if (recent.error) {
      console.error("Unable to check recent codes:", recent.error.message);
      return { ok: false, reason: "error" };
    }

    if ((recent.count ?? 0) >= MAX_PER_HOUR) {
      return { ok: false, reason: "rate" };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const now = new Date();

    await admin
      .from("email_codes")
      .update({ used_at: now.toISOString() })
      .eq("student_id", args.studentId)
      .eq("purpose", args.purpose)
      .is("used_at", null);

    const { error } = await admin.from("email_codes").insert({
      purpose: args.purpose,
      student_id: args.studentId,
      email: args.email,
      code_hash: hashCode(args.purpose, args.studentId, args.email, code),
      expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
    });

    if (error) {
      console.error("Saving the code failed:", error.message);
      return { ok: false, reason: "error" };
    }

    return { ok: true, code };
  } catch (error) {
    console.error("Issuing a code failed:", error);
    return { ok: false, reason: "error" };
  }
}

export type ConsumeResult = "ok" | "invalid" | "expired" | "locked" | "error";

/** Checks a code. A correct code works once. */
export async function consumeCode(
  admin: Admin,
  args: { purpose: Purpose; studentId: string; email: string; code: string },
): Promise<ConsumeResult> {
  try {
    const { data, error } = await admin.rpc("consume_email_code", {
      p_purpose: args.purpose,
      p_student_id: args.studentId,
      p_email: args.email,
      p_hash: hashCode(args.purpose, args.studentId, args.email, args.code),
    });

    if (error) {
      console.error("Checking the code failed:", error.message);
      return "error";
    }

    return data === "ok" || data === "expired" || data === "locked" ? data : "invalid";
  } catch (error) {
    console.error("Checking a code failed:", error);
    return "error";
  }
}
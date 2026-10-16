import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { findExistingKeys } from "@/lib/students/import-existing";
import {
  duplicateKey,
  importRowSchema,
  type BatchResult,
} from "@/lib/students/import-schema";
import { registerOne } from "@/lib/students/register";

const bodySchema = z.object({
  rows: z
    .array(z.object({ rowNumber: z.number().int(), row: importRowSchema }))
    .min(1)
    .max(25),
});

export async function POST(request: Request) {
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let rows: z.infer<typeof bodySchema>["rows"];

  try {
    const body: unknown = await request.json();
    rows = bodySchema.parse(body).rows;
  } catch {
    return NextResponse.json(
      { error: "The batch wasn't in the expected format." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const classIds = [...new Set(rows.map((item) => item.row.classId))];

  const { data: classRows, error: classError } = await admin
    .from("classes")
    .select("id, is_active")
    .in("id", classIds);

  if (classError) {
    console.error("Unable to load classes:", classError.message);
    return NextResponse.json(
      { error: "Unable to load the classes." },
      { status: 500 },
    );
  }

  const activeClasses = new Set(
    (classRows ?? []).filter((item) => item.is_active).map((item) => item.id as string),
  );

  const seen = await findExistingKeys(
    admin,
    rows.map((item) => item.row),
  );

  if (!seen) {
    return NextResponse.json(
      { error: "Unable to check for students who already exist." },
      { status: 500 },
    );
  }

  const results: BatchResult[] = [];

  // One at a time, so admission numbers follow the row order.
  for (const { rowNumber, row } of rows) {
    const name = [row.firstName, row.lastName].join(" ");
    const key = duplicateKey(row);

    if (seen.has(key)) {
      results.push({
        rowNumber,
        name,
        status: "skipped",
        message: "A student with this name and date of birth already exists.",
      });
      continue;
    }

    if (!activeClasses.has(row.classId)) {
      results.push({
        rowNumber,
        name,
        status: "failed",
        message: "The class is no longer active.",
      });
      continue;
    }

    const outcome = await registerOne(admin, row, access.user.id);

    if (!outcome.ok) {
      results.push({ rowNumber, name, status: "failed", message: outcome.error });
      continue;
    }

    seen.add(key);

    results.push({
      rowNumber,
      name,
      status: "created",
      admissionNumber: outcome.admissionNumber,
      password: outcome.password,
    });
  }

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
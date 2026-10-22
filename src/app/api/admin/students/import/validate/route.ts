import { NextResponse } from "next/server";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { findExistingKeys } from "@/lib/students/import-existing";
import { readSheet } from "@/lib/students/import-parse";
import {
  classKey,
  duplicateKey,
  validateRawRow,
  type ValidationSummary,
} from "@/lib/students/import-schema";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  let file: File | null = null;

  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json(
      { error: "The upload could not be read." },
      { status: 400 },
    );
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "The file must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const lowerName = file.name.toLowerCase();
  const extension = lowerName.endsWith(".xlsx")
    ? "xlsx"
    : lowerName.endsWith(".csv")
      ? "csv"
      : null;

  if (!extension) {
    return NextResponse.json(
      { error: "Upload an .xlsx or .csv file." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Check the real contents, not just the file name.
  const looksLikeXlsx = buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (extension === "xlsx" && !looksLikeXlsx) {
    return NextResponse.json(
      { error: "That isn't a real Excel file." },
      { status: 400 },
    );
  }

  if (extension === "csv" && buffer.includes(0)) {
    return NextResponse.json(
      { error: "That isn't a real CSV file." },
      { status: 400 },
    );
  }

  const sheet = await readSheet(buffer, extension);

  if (!sheet.ok) {
    return NextResponse.json({ error: sheet.error }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: classRows, error: classError } = await admin
    .from("classes")
    .select("id, name")
    .eq("is_active", true);

  if (classError) {
    console.error("Unable to load classes:", classError.message);
    return NextResponse.json(
      { error: "Unable to load the classes." },
      { status: 500 },
    );
  }

  const classes = new Map(
    (classRows ?? []).map((item) => [
      classKey(item.name as string),
      { id: item.id as string, name: item.name as string },
    ]),
  );

  const summary: ValidationSummary = {
    total: sheet.rows.length,
    ready: [],
    existing: [],
    invalid: [],
  };

  const firstSeen = new Map<string, number>();

  for (const { rowNumber, raw } of sheet.rows) {
    const label = [raw.firstName, raw.lastName].filter(Boolean).join(" ") || "(no name)";
    const result = validateRawRow(raw, classes);

    if (!result.ok) {
      summary.invalid.push({ rowNumber, name: label, errors: result.errors });
      continue;
    }

    const key = duplicateKey(result.row);
    const earlier = firstSeen.get(key);

    if (earlier !== undefined) {
      summary.invalid.push({
        rowNumber,
        name: label,
        errors: [`Same name and date of birth as row ${earlier}.`],
      });
      continue;
    }

    firstSeen.set(key, rowNumber);

    summary.ready.push({
      rowNumber,
      name: label,
      className: result.className,
      row: result.row,
    });
  }

  const existingKeys = await findExistingKeys(
    admin,
    summary.ready.map((item) => item.row),
  );

  if (!existingKeys) {
    return NextResponse.json(
      { error: "Unable to check for students who already exist." },
      { status: 500 },
    );
  }

  const stillReady: ValidationSummary["ready"] = [];

  for (const item of summary.ready) {
    if (existingKeys.has(duplicateKey(item.row))) {
      summary.existing.push({ rowNumber: item.rowNumber, name: item.name });
    } else {
      stillReady.push(item);
    }
  }

  summary.ready = stillReady;

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
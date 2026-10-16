import "server-only";

import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import {
  HEADER_KEYS,
  REQUIRED_KEYS,
  normalizeHeader,
  type RawKey,
  type RawRecord,
} from "@/lib/students/import-schema";

export const MAX_ROWS = 500;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "object") {
    const object = value as unknown as Record<string, unknown>;

    if (typeof object.text === "string") return object.text.trim();

    if (Array.isArray(object.richText)) {
      return (object.richText as { text: string }[])
        .map((part) => part.text)
        .join("")
        .trim();
    }

    if ("result" in object) return cellText(object.result as ExcelJS.CellValue);

    return "";
  }

  return String(value).trim();
}

export type ParsedSheet =
  | { ok: true; rows: { rowNumber: number; raw: RawRecord }[] }
  | { ok: false; error: string };

export async function readSheet(
  buffer: Buffer,
  extension: "xlsx" | "csv",
): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();

  try {
    if (extension === "xlsx") {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } else {
      await workbook.csv.read(Readable.from([buffer]), {
        map: (value: unknown) => value,
      });
    }
  } catch (error) {
    console.error("Unable to read the import file:", error);
    return { ok: false, error: "The file couldn't be read. Check that it's a valid Excel or CSV file." };
  }

  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return { ok: false, error: "The file has no sheet to read." };
  }

  const columns: Partial<Record<RawKey, number>> = {};

  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const key = HEADER_KEYS[normalizeHeader(cellText(cell.value))];

    if (key && columns[key] === undefined) {
      columns[key] = columnNumber;
    }
  });

  const missing = REQUIRED_KEYS.filter((key) => columns[key] === undefined);

  if (missing.length > 0) {
    return {
      ok: false,
      error:
        "The first row must contain the template's column names. Download the template and copy your data into it.",
    };
  }

  const rows: { rowNumber: number; raw: RawRecord }[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    const raw = {
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      admissionSession: "",
      admissionDate: "",
      className: "",
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
    } as RawRecord;

    for (const key of Object.keys(raw) as RawKey[]) {
      const column = columns[key];

      if (column !== undefined) {
        raw[key] = cellText(row.getCell(column).value);
      }
    }

    if (Object.values(raw).every((value) => value === "")) continue;

    rows.push({ rowNumber, raw });
  }

  if (rows.length === 0) {
    return { ok: false, error: "The file has no student rows." };
  }

  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `The file has ${rows.length} rows. Import at most ${MAX_ROWS} at a time.`,
    };
  }

  return { ok: true, rows };
}
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATE_HEADERS } from "@/lib/students/import-schema";

export async function GET(request: Request) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const format = new URL(request.url).searchParams.get("format");

  if (format === "csv") {
    return new NextResponse(`\uFEFF${TEMPLATE_HEADERS.join(",")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="students-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = createAdminClient();

  const { data: classes } = await admin
    .from("classes")
    .select("name")
    .eq("is_active", true)
    .order("level_number", { ascending: true })
    .order("section", { ascending: true, nullsFirst: true });

  const workbook = new ExcelJS.Workbook();

  const students = workbook.addWorksheet("Students");
  students.addRow([...TEMPLATE_HEADERS]);
  students.getRow(1).font = { bold: true };
  students.views = [{ state: "frozen", ySplit: 1 }];

  // Plain text columns keep phone numbers and dates exactly as typed.
  TEMPLATE_HEADERS.forEach((_, index) => {
    const column = students.getColumn(index + 1);
    column.width = 22;
    column.numFmt = "@";
  });

  const guide = workbook.addWorksheet("Guide");
  guide.getColumn(1).width = 26;
  guide.getColumn(2).width = 70;

  guide.addRows([
    ["How to fill the Students sheet", ""],
    ["", ""],
    ["Required columns", "First name, Last name, Date of birth, Admission session, Admission date, Class, Guardian name, Guardian phone"],
    ["Optional columns", "Middle name, Gender, Guardian relationship"],
    ["Dates", "Write them as 2019-04-12 (year-month-day)."],
    ["Admission session", "The session the student was admitted in, like 2023/2024. It sets the admission number."],
    ["Class", "Must match a class name exactly, from the list below."],
    ["Gender", "Male or Female."],
    ["Guardian relationship", "Mother, Father, Guardian or Other."],
    ["Siblings", "Give them the same guardian phone number. They'll share one guardian record."],
    ["Row order", "Admission numbers are issued in row order, so sort by admission order."],
    ["", ""],
    ["Example row (do not copy)", "Ada | Grace | Example | 2019-04-12 | Female | 2023/2024 | 2023-09-11 | Primary 1 | Parent Example | 08000000000 | Mother"],
    ["", ""],
    ["Classes you can use", ""],
  ]);

  guide.getRow(1).font = { bold: true };

  for (const item of classes ?? []) {
    guide.addRow(["", item.name as string]);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
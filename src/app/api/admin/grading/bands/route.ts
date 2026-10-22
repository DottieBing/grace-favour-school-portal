import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const bandSchema = z.object({
  grade: z.string().trim().min(1, "Every band needs a grade.").max(10),
  minPercent: z
    .number()
    .min(0, "Percentages must be between 0 and 100.")
    .max(100, "Percentages must be between 0 and 100.")
    .refine((value) => Math.round(value * 100) / 100 === value, {
      message: "Use at most two decimal places.",
    }),
  remark: z
    .string()
    .trim()
    .max(40, "Remarks can be at most 40 characters.")
    .transform((value) => (value === "" ? null : value)),
  points: z
    .number()
    .min(0, "Points can't be negative.")
    .max(99, "Points can't be more than 99.")
    .nullable(),
});

const schema = z
  .object({ bands: z.array(bandSchema).min(1, "Add at least one band.").max(15) })
  .superRefine((value, ctx) => {
    const mins = new Set<number>();
    const grades = new Set<string>();

    for (const band of value.bands) {
      if (mins.has(band.minPercent)) {
        ctx.addIssue({
          code: "custom",
          message: `Two bands start at ${band.minPercent}%.`,
        });
      }

      if (grades.has(band.grade.toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          message: `The grade "${band.grade}" is used twice.`,
        });
      }

      mins.add(band.minPercent);
      grades.add(band.grade.toLowerCase());
    }

    if (!mins.has(0)) {
      ctx.addIssue({
        code: "custom",
        message: "One band must start at 0%, so every score gets a grade.",
      });
    }
  });

export async function PUT(request: Request) {
  const access = await getAdminAccess("grading", "manage");

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
        ? (error.issues[0]?.message ?? "Invalid grade scale.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("save_grade_bands", {
    p_bands: input.bands.map((band) => ({
      grade: band.grade,
      min_percent: band.minPercent,
      remark: band.remark ?? "",
      points: band.points === null ? "" : band.points,
    })),
  });

  if (error) {
    console.error("Saving grade bands failed:", error.message);

    return NextResponse.json(
      { error: "Unable to save the grade scale." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Grade scale saved." });
}
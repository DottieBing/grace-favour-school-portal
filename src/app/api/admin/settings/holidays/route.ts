import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  startDate: z.string().date("Enter a valid start date."),
  endDate: z.union([z.literal(""), z.string().date("Enter a valid end date.")]),
});

export async function POST(request: Request) {
  const access = await getAccess("super_admin");

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
        ? (error.issues[0]?.message ?? "Invalid holiday.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const endDate = input.endDate === "" ? input.startDate : input.endDate;

  if (endDate < input.startDate) {
    return NextResponse.json(
      { error: "The end date can't be before the start date." },
      { status: 400 },
    );
  }

  const days =
    (new Date(`${endDate}T00:00:00Z`).getTime() -
      new Date(`${input.startDate}T00:00:00Z`).getTime()) /
    86_400_000;

  if (days > 366) {
    return NextResponse.json(
      { error: "A holiday can't be longer than a year." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.from("school_holidays").insert({
    name: input.name,
    start_date: input.startDate,
    end_date: endDate,
  });

  if (error) {
    console.error("Holiday creation failed:", error.message);
    return NextResponse.json({ error: "Unable to save the holiday." }, { status: 500 });
  }

  return NextResponse.json({ message: "Holiday added." }, { status: 201 });
}
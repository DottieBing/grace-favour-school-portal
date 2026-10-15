import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const TERM_LABELS = ["First term", "Second term", "Third term"];

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Use the session format 2026/2027."),
    terms: z
      .array(
        z.object({
          startDate: z.string().date("Enter valid term dates."),
          endDate: z.string().date("Enter valid term dates."),
        }),
      )
      .length(3, "Enter dates for all three terms."),
  })
  .superRefine((value, ctx) => {
    const [from, to] = value.name.split("/").map(Number);

    if (to !== from + 1) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "The second year must follow the first, like 2026/2027.",
      });
    }

    value.terms.forEach((term, index) => {
      if (term.endDate <= term.startDate) {
        ctx.addIssue({
          code: "custom",
          path: ["terms", index],
          message: `${TERM_LABELS[index]} must end after it starts.`,
        });
      }

      const previous = value.terms[index - 1];

      if (previous && term.startDate <= previous.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["terms", index],
          message: `${TERM_LABELS[index]} must start after ${TERM_LABELS[
            index - 1
          ].toLowerCase()} ends.`,
        });
      }
    });
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
        ? (error.issues[0]?.message ?? "Invalid session details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("create_academic_session", {
    p_name: input.name,
    p_terms: input.terms.map((term, index) => ({
      term_number: index + 1,
      start_date: term.startDate,
      end_date: term.endDate,
    })),
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A session with this name already exists." },
        { status: 409 },
      );
    }

    console.error("Session creation failed:", error.message);

    return NextResponse.json(
      { error: "Unable to create the session." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { message: "Session created." },
    { status: 201 },
  );
}
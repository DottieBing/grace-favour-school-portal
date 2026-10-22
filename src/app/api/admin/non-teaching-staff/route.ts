import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAdminAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  staffNumber: z.string().trim().min(2).max(30),
  jobTitle: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
  email: z
    .union([z.literal(""), z.string().trim().email().max(254)])
    .optional(),
  employmentDate: z.string().date(),
});

export async function POST(request: Request) {
    // 1 and 2. Verify the requester is an active Super Admin.
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  // 3. Validate the submitted details.
  let input: z.infer<typeof createStaffSchema>;

  try {
    const body: unknown = await request.json();
    input = createStaffSchema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid staff details."
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Create the staff record. No auth account is created.
  const admin = createAdminClient();

  const { data: created, error: insertError } = await admin
    .from("staff")
    .insert({
      user_id: null,
      staff_type: "non_teaching",
      full_name: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      department: input.department,
      staff_number: input.staffNumber,
      job_title: input.jobTitle,
      employment_date: input.employmentDate,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    // 23505 = unique violation (staff number or email already used)
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "A staff member with this staff number or email already exists." },
        { status: 409 },
      );
    }

    console.error("Non-teaching staff creation failed:", insertError?.message);

    return NextResponse.json(
      { error: "Unable to create the staff record." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      message: "Staff record created successfully.",
      staff: {
        id: created.id,
        fullName: input.fullName,
        staffNumber: input.staffNumber,
        jobTitle: input.jobTitle,
        department: input.department,
        staffType: "non_teaching",
        isActive: true,
      },
    },
    { status: 201 },
  );
}
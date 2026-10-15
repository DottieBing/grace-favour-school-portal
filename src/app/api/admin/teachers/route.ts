import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

const createTeacherSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  staffNumber: z.string().trim().min(2).max(30),
  jobTitle: z.string().trim().min(2).max(100),
  employmentDate: z.string().date(),
});

export async function POST(request: Request) {
    // 1 and 2. Verify the requester is an active Super Admin.
  const access = await getAccess("super_admin");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const user = access.user;

  // 3. Validate the submitted details.
  let input: z.infer<typeof createTeacherSchema>;

  try {
    const body: unknown = await request.json();
    input = createTeacherSchema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid teacher details."
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Create the teacher's account using the server-only admin client.
  const admin = createAdminClient();

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
      },
    });

  if (createUserError || !createdUser.user) {
    const message = createUserError?.message ?? "";

    if (
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("duplicate")
    ) {
      return NextResponse.json(
        { error: "An account with this email may already exist." },
        { status: 409 },
      );
    }

    console.error("Teacher account creation failed:", message);

    return NextResponse.json(
      { error: "Unable to create the teacher account." },
      { status: 400 },
    );
  }

  const newUserId = createdUser.user.id;

  // 5. Assign the teacher role and create the staff record.
  // The database trigger should create the corresponding profiles row.
  const { error: roleInsertError } = await admin
    .from("user_roles")
    .insert({
      user_id: newUserId,
      role: "teacher",
      granted_by: user.id,
    });

  if (roleInsertError) {
    console.error("Teacher role creation failed:", roleInsertError.message);

    await admin.auth.admin.deleteUser(newUserId);

    return NextResponse.json(
      { error: "Unable to assign the teacher role. No account was retained." },
      { status: 500 },
    );
  }

  const { error: staffInsertError } = await admin.from("staff").insert({
    user_id: newUserId,
    staff_type: "teaching",
    full_name: input.fullName,
    email: input.email,
    staff_number: input.staffNumber,
    job_title: input.jobTitle,
    employment_date: input.employmentDate,
    is_active: true,
  });

  if (staffInsertError) {
    console.error("Staff record creation failed:", staffInsertError.message);

    await admin.auth.admin.deleteUser(newUserId);

    return NextResponse.json(
      {
        error:
          "Unable to create the staff record. The account creation was rolled back.",
      },
      { status: 500 },
    );
  }

  // 6. Return only the information the interface needs.
  return NextResponse.json(
    {
      message: "Teacher account created successfully.",
      teacher: {
        id: newUserId,
        fullName: input.fullName,
        email: input.email,
        staffNumber: input.staffNumber,
        jobTitle: input.jobTitle,
        employmentDate: input.employmentDate,
        role: "teacher",
        isActive: true,
      },
    },
    { status: 201 },
  );
}
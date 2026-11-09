import { NextResponse } from "next/server";
import { z } from "zod";

import { accessErrorResponse, getAccess, getAdminAccess } from "@/lib/auth/access";
import { readConfirm } from "@/lib/delete/confirm";
import { createAdminClient } from "@/lib/supabase/admin";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalDate = z
  .union([z.string().date(), z.literal("")])
  .transform((value) => (value === "" ? null : value));

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name.").max(120),
  jobTitle: z.string().trim().min(2, "Enter a job title.").max(100),
  department: optionalText(100),
  phone: optionalText(30),
  email: z
    .union([z.email("Enter a valid email."), z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  employmentDate: z.string().date("Pick a valid employment date."),
  gender: z
    .enum(["male", "female", ""])
    .transform((value) => (value === "" ? null : value)),
  dateOfBirth: optionalDate,
  address: optionalText(300),
  qualification: optionalText(150),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(30),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getAdminAccess("students", "manage");

  if (!access.ok) {
    return accessErrorResponse(access);
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
  }

  let input: z.infer<typeof schema>;

  try {
    const body: unknown = await request.json();
    input = schema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "The request body must contain valid JSON.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing, error: loadError } = await admin
    .from("staff")
    .select("id, user_id, full_name")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load staff record:", loadError.message);
    return NextResponse.json(
      { error: "Unable to load the staff record." },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Staff record not found." },
      { status: 404 },
    );
  }

  const update: Record<string, string | null> = {
    full_name: input.fullName,
    job_title: input.jobTitle,
    department: input.department,
    phone: input.phone,
    employment_date: input.employmentDate,
    gender: input.gender,
    date_of_birth: input.dateOfBirth,
    address: input.address,
    qualification: input.qualification,
    emergency_contact_name: input.emergencyContactName,
    emergency_contact_phone: input.emergencyContactPhone,
  };

  // A login email belongs to the Auth account, so only staff without a login
  // can have their email changed here.
  if (!existing.user_id) {
    update.email = input.email;
  }

  const { error: updateError } = await admin
    .from("staff")
    .update(update)
    .eq("id", id);

  if (updateError) {
    console.error("Staff update failed:", updateError.message);
    return NextResponse.json(
      { error: "Unable to save the changes." },
      { status: 500 },
    );
  }

  // Keep the login profile's name in step with the staff record.
  if (existing.user_id && existing.full_name !== input.fullName) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: input.fullName })
      .eq("id", existing.user_id);

    if (profileError) {
      console.error("Profile name sync failed:", profileError.message);

      // Put the staff name back so the two records never disagree.
      await admin
        .from("staff")
        .update({ full_name: existing.full_name })
        .eq("id", id);

      return NextResponse.json(
        { error: "Unable to save the changes. Nothing was changed." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Staff details updated." });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  // Owner-only.
  const access = await getAccess("super_admin");

  if (!access.ok) return accessErrorResponse(access);

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
  }

  const confirm = await readConfirm(request);
  const admin = createAdminClient();

  const found = await admin
    .from("staff")
    .select("staff_number, user_id")
    .eq("id", id)
    .maybeSingle();

  if (found.error) {
    console.error("Unable to load staff:", found.error.message);
    return NextResponse.json({ error: "Unable to delete the staff member." }, { status: 500 });
  }

  if (!found.data) {
    return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
  }

  const userId = (found.data.user_id as string | null) ?? null;

  if (userId === access.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  if (userId) {
    const roles = await admin.from("user_roles").select("role").eq("user_id", userId);

    if (roles.error) {
      console.error("Unable to check roles:", roles.error.message);
      return NextResponse.json({ error: "Unable to delete the staff member." }, { status: 500 });
    }

    if ((roles.data ?? []).some((item) => item.role === "super_admin")) {
      return NextResponse.json(
        { error: "Super Admin accounts can't be deleted from this screen." },
        { status: 403 },
      );
    }
  }

  if (confirm !== found.data.staff_number) {
    return NextResponse.json(
      { error: "Type the staff number exactly to confirm." },
      { status: 400 },
    );
  }

  const { data, error } = await admin.rpc("delete_staff_permanently", { p_staff_id: id });

  if (error) {
    console.error("Deleting the staff member failed:", error.message);
    return NextResponse.json(
      { error: "Unable to delete the staff member. Nothing was removed." },
      { status: 500 },
    );
  }

  const result = data as { user_id: string | null; photo_path: string | null };

  if (result.photo_path) {
    const { error: photoError } = await admin.storage
      .from("staff-photos")
      .remove([result.photo_path]);

    if (photoError) console.error("Removing the photo failed:", photoError.message);
  }

  if (result.user_id) {
    const { error: loginError } = await admin.auth.admin.deleteUser(result.user_id);

    if (loginError) {
      console.error("Deleting the login failed:", loginError.message);
      return NextResponse.json(
        {
          error:
            "The staff record was deleted, but the login couldn't be removed. Delete it in Supabase under Authentication → Users.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Staff member deleted." });
}
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentPhoto } from "@/components/students/student-photo";
import {
  ChangeClassButton,
  ChangeStatusButton,
  ResetStudentPasswordButton,
  type ClassChoice,
  type StudentStatus,
} from "@/components/students/student-profile-actions";
import { StudentTabs } from "@/components/students/student-tabs";
import { StudentAttendanceSection } from "@/components/students/student-attendance-section";
import { StudentAcademicsSection } from "@/components/students/student-academics-section";
import { StudentOverviewCards } from "@/components/students/student-overview-cards";

type GuardianRaw = {
  is_primary: boolean;
  guardians: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    email_verified_at: string | null;
    relationship: string | null;
  } | null;
};

const STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  transferred: "Transferred",
  graduated: "Graduated",
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value || "Not set"}</div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function ProfileContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAreaAccess("students");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const admin = createAdminClient();

  const [studentResult, guardiansResult, classesResult, countsResult] =
    await Promise.all([
      admin
        .from("students")
        .select(
          "id, user_id, admission_number, admission_session, first_name, middle_name, last_name, date_of_birth, gender, admission_date, current_class_id, photo_path, status",
        )
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("student_guardians")
        .select(
          "is_primary, guardians(full_name, phone, email, email_verified_at, relationship)",
        )
        .eq("student_id", id),
      admin
        .from("classes")
        .select("id, name, capacity")
        .eq("is_active", true)
        .order("level_number", { ascending: true })
        .order("section", { ascending: true, nullsFirst: true }),
      admin
        .from("students")
        .select("current_class_id")
        .eq("status", "active")
        .not("current_class_id", "is", null),
    ]);

  const failed =
    studentResult.error ??
    guardiansResult.error ??
    classesResult.error ??
    countsResult.error;

  if (failed) {
    console.error("Unable to load student profile:", failed.message);

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load this profile. Please refresh the page.
        </div>
      </div>
    );
  }

  const student = studentResult.data;

  if (!student) {
    notFound();
  }

  const name = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
  const status = student.status as StudentStatus;
  const active = status === "active";

  const counts = new Map<string, number>();

  for (const row of countsResult.data ?? []) {
    const classId = row.current_class_id as string;
    counts.set(classId, (counts.get(classId) ?? 0) + 1);
  }

  const classChoices: ClassChoice[] = (classesResult.data ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    count: counts.get(item.id as string) ?? 0,
    capacity: (item.capacity as number | null) ?? null,
  }));

  const currentClassName =
    classChoices.find((item) => item.id === student.current_class_id)?.name ??
    null;

  let photoUrl: string | null = null;

  if (student.photo_path) {
    const { data: signed } = await admin.storage
      .from("student-photos")
      .createSignedUrl(student.photo_path as string, 3600);

    photoUrl = signed?.signedUrl ?? null;
  }

  let lastSignIn: string | null = null;

  if (student.user_id) {
    const { data: authData } = await admin.auth.admin.getUserById(
      student.user_id as string,
    );
    lastSignIn = authData.user?.last_sign_in_at ?? null;
  }

  const guardians = (guardiansResult.data ?? []) as unknown as GuardianRaw[];

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-6">
          <Suspense
            fallback={<div className="h-28 animate-pulse rounded-xl bg-slate-100" />}
          >
            <StudentOverviewCards studentId={student.id as string} />
          </Suspense>

          <Card title="Details">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Detail
                label="Gender"
                value={
                  student.gender
                    ? student.gender.charAt(0).toUpperCase() +
                      student.gender.slice(1)
                    : null
                }
              />
              <Detail
                label="Date of birth"
                value={
                  student.date_of_birth
                    ? formatDate(student.date_of_birth as string)
                    : null
                }
              />
              <Detail
                label="Admission date"
                value={formatDate(student.admission_date as string)}
              />
              <Detail
                label="Admission session"
                value={(student.admission_session as string | null) ?? null}
              />
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: "academics",
      label: "Academics",
      content: (
        <Suspense
          fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}
        >
          <StudentAcademicsSection studentId={student.id as string} />
        </Suspense>
      ),
    },
    {
      id: "attendance",
      label: "Attendance",
      content: (
        <Suspense
          fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}
        >
          <StudentAttendanceSection studentId={student.id as string} />
        </Suspense>
      ),
    },
    {
      id: "fees",
      label: "Fees",
      content: (
        <EmptyState
          title="No fee records yet"
          text="The fee structure, payments, balance and receipts appear here once fees are set up."
        />
      ),
    },
    {
      id: "guardians",
      label: "Guardians",
      content:
        guardians.length === 0 ? (
          <EmptyState
            title="No guardian linked"
            text="This student has no guardian on record."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {guardians.map((link, index) => (
              <Card
                key={index}
                title={link.is_primary ? "Primary guardian" : "Guardian"}
              >
                <div className="grid grid-cols-2 gap-4">
                  <Detail
                    label="Name"
                    value={link.guardians?.full_name ?? null}
                  />
                  <Detail
                    label="Relationship"
                    value={link.guardians?.relationship ?? null}
                  />
                  <Detail label="Phone" value={link.guardians?.phone ?? null} />
                  <Detail
                    label="Email"
                    value={
                      link.guardians?.email
                        ? link.guardians.email_verified_at
                          ? `${link.guardians.email} (verified)`
                          : `${link.guardians.email} (not verified)`
                        : "Not added yet"
                    }
                  />
                </div>
              </Card>
            ))}
          </div>
        ),
    },
    {
      id: "account",
      label: "Account",
      content: (
        <div className="space-y-6">
          <Card title="Login">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Detail
                label="Username (admission number)"
                value={student.admission_number as string}
              />
              <Detail
                label="Last sign-in"
                value={
                  lastSignIn
                    ? new Date(lastSignIn).toLocaleString("en-GB")
                    : "Never signed in"
                }
              />
              <Detail label="Status" value={STATUS_LABELS[status]} />
            </div>

            <div className="mt-5">
              <ResetStudentPasswordButton
                studentId={student.id as string}
                name={name}
                admissionNumber={student.admission_number as string}
                disabled={!active || !student.user_id}
              />
              {!active ? (
                <p className="mt-2 text-sm text-slate-500">
                  Set the student back to Active to reset their password.
                </p>
              ) : null}
            </div>
          </Card>

          <section className="rounded-xl border border-red-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-red-700">
              Class and status
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Withdrawing, transferring or graduating a student blocks their
              login. Their records stay.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ChangeClassButton
                studentId={student.id as string}
                name={name}
                currentClassId={(student.current_class_id as string | null) ?? null}
                classes={classChoices}
                disabled={!active}
              />
              <ChangeStatusButton
                studentId={student.id as string}
                name={name}
                status={status}
              />
            </div>
          </section>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Back to students
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start gap-6">
          <StudentPhoto
            studentId={student.id as string}
            name={name}
            photoUrl={photoUrl}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
              <span
                className={
                  active
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                }
              >
                {STATUS_LABELS[status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {currentClassName ?? "No class"}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {student.admission_number as string}
            </p>
          </div>
        </div>
      </div>

      <StudentTabs tabs={tabs} />
    </div>
  );
}

function ProfileFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileContent params={params} />
    </Suspense>
  );
}
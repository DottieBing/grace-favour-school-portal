import { Suspense } from "react";
import { connection } from "next/server";

import { getSchoolProfile } from "@/lib/settings/school";
import { LoginForm } from "./login-form";

async function Form() {
  await connection();
  const school = await getSchoolProfile();

  return <LoginForm schoolName={school.name} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9F8F4]" />}>
      <Form />
    </Suspense>
  );
}
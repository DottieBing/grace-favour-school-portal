import { Suspense } from "react";
import { connection } from "next/server";

import { getSchoolProfile } from "@/lib/settings/school";
import { LoginForm } from "./login-form";
import { BrandLoader } from "@/components/kit/brand-loader";

async function Form() {
  await connection();
  const school = await getSchoolProfile();

  return <LoginForm schoolName={school.name} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <Form />
    </Suspense>
  );
}
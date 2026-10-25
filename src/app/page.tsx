import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function Router() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const names = (roles ?? []).map((item) => item.role as string);

  redirect(
    names.includes("super_admin") || names.includes("admin_user")
      ? "/admin"
      : names.includes("teacher")
        ? "/teacher"
        : names.includes("student")
          ? "/portal"
          : "/unauthorized",
  );

  return null;
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Router />
    </Suspense>
  );
}
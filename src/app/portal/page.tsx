import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PortalPlaceholder } from "@/components/portal/portal-placeholder";

async function PortalGate() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <PortalPlaceholder />;
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F8F5]" />}>
      <PortalGate />
    </Suspense>
  );
}
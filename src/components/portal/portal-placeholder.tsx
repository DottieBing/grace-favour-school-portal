"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PortalPlaceholder() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);

    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8F5] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#E8ECE7] bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          You&apos;re signed in
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your portal for results, attendance and fees is still being built.
          The school will let you know when it&apos;s ready.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={signOut}
          disabled={signingOut}
          className="mt-6 gap-2"
        >
          <LogOut className="size-4" />
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    </main>
  );
}
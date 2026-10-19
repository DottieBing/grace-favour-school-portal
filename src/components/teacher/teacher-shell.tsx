"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";

export function TeacherShell({
  name,
  term,
  children,
}: {
  name: string;
  term: { sessionName: string; termName: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
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

  const onAttendance = pathname.startsWith("/teacher/attendance");

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#203432]">
      <header className="sticky top-0 z-30 border-b border-[#E8ECE7] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D5C63] text-white">
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="text-sm font-bold leading-4">Grace & Favour</p>
              <p className="text-xs text-[#89938E]">
                {term
                  ? `${term.sessionName} · ${term.termName}`
                  : "No current term"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden max-w-[200px] truncate text-xs font-semibold sm:block">
              {name}
            </p>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[#E2E8E1] px-3 text-xs font-medium text-[#40534C] hover:bg-[#F8FAF7] disabled:opacity-60"
            >
              <LogOut size={14} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-4xl gap-1 px-4 pb-2">
          <Link
            href="/teacher/attendance"
            aria-current={onAttendance ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              onAttendance
                ? "bg-[#0D5C63] text-white"
                : "text-[#53645D] hover:bg-[#F1F5F2]"
            }`}
          >
            Attendance
          </Link>
          <span
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-[#A2AAA5]"
          >
            Results
            <span className="rounded-full bg-[#EEF1EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Soon
            </span>
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl">{children}</main>
    </div>
  );
}
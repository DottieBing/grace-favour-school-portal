"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { SchoolLogo } from "@/components/brand/school-logo";

const NAV = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/results", label: "Results", exact: false },
  { href: "/portal/attendance", label: "Attendance", exact: false },
  { href: "/portal/account", label: "Account", exact: false },
];

export function PortalShell({
  name,
  className,
  term,
  children,
}: {
  name: string;
  className: string | null;
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

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#203432]">
      <header className="sticky top-0 z-30 border-b border-[#E8ECE7] bg-white/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#E2E8E1] bg-white p-1">
              <SchoolLogo size={32} />
            </div>
            <div>
              <p className="text-sm font-bold leading-4">Grace & Favour</p>
              <p className="text-xs text-[#89938E]">
                {term
                  ? `${term.sessionName} · ${term.termName}`
                  : "Model School"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[220px] truncate text-xs font-semibold">
                {name}
              </p>
              <p className="text-xs text-[#89938E]">{className ?? "No class"}</p>
            </div>
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

        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-[#0D5C63] text-white"
                    : "text-[#53645D] hover:bg-[#F1F5F2]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <span
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-[#A2AAA5]"
          >
            Fees
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
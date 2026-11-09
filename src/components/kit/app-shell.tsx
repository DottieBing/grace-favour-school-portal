"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";

import { Avatar } from "@/components/kit/avatar";
import { SchoolLogo } from "@/components/brand/school-logo";
import { NavProgress } from "@/components/kit/nav-progress";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export function AppShell({
  schoolName,
  name,
  roleLabel,
  photoUrl,
  term,
  items,
  children,
}: {
  schoolName: string;
  name: string;
  roleLabel: string;
  photoUrl: string | null;
  term: { sessionName: string; termName: string } | null;
  items: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

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
    <div className="min-h-screen bg-[#F4F7F5] text-[#203432]">
      <NavProgress />
      <header className="print:hidden sticky top-0 z-30 border-b border-black/5 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link href={items[0].href} className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-[#E2E8E1] bg-white p-1">
              <SchoolLogo size={32} />
            </span>
            <span className="leading-tight">
              <span className="block max-w-[11rem] truncate text-sm font-bold">{schoolName}</span>
              <span className="block text-xs text-[#89938E]">
                {term ? `${term.sessionName} · ${term.termName}` : "No current term"}
              </span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#0D5C63] text-white"
                      : "text-[#53645D] hover:bg-[#EAF0ED]"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="rounded-full ring-2 ring-transparent transition hover:ring-[#0D5C63]/20"
            >
              <Avatar name={name} photoUrl={photoUrl} size={40} />
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="anim-pop absolute right-0 top-12 z-50 w-64 rounded-2xl border border-black/5 bg-white p-3 shadow-xl">
                  <div className="flex items-center gap-3 px-1 pb-3">
                    <Avatar name={name} photoUrl={photoUrl} size={44} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="text-xs text-[#89938E]">{roleLabel}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 rounded-xl border-t border-black/5 px-3 pt-3 pb-2 text-sm text-[#B84E40] hover:bg-[#FDF2F0] disabled:opacity-60"
                  >
                    <LogOut size={16} />
                    {signingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/90 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-xl md:hidden"
      >
        <ul
          className="mx-auto grid max-w-md px-2 pt-2"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center gap-1 py-1"
                >
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 ${
                      active ? "scale-105 bg-[#0D5C63] text-white" : "text-[#7D8983]"
                    }`}
                  >
                    <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      active ? "text-[#0D5C63]" : "text-[#7D8983]"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
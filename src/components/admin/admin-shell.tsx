"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  X,
  Library,
  type LucideIcon,
} from "lucide-react";

type NavigationItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  section?: string;
};

// Items without an href are modules we haven't built yet.
const navigation: NavigationItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin", section: "Overview" },
  {
    label: "Students",
    icon: GraduationCap,
    href: "/admin/students",
    section: "School Management",
  },
  { label: "Teachers & Staff", icon: Users, href: "/admin/staff" },
  { label: "Classes", icon: BookOpen, href: "/admin/classes" },
  { label: "Subjects", icon: Library, href: "/admin/subjects" },
  {
    label: "Attendance",
    icon: ClipboardCheck,
    href: "/admin/attendance",
    section: "Daily Operations",
  },
  { label: "Results & Reports", icon: FileCheck2 },
  { label: "Fees & Payments", icon: Wallet, section: "Finance" },
  { label: "Timetable", icon: CalendarDays, section: "Administration" },
  { label: "Academic Sessions", icon: CalendarRange, href: "/admin/sessions" },
  { label: "Settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  email,
  term,
  children,
}: {
  email: string;
  term: { sessionName: string; termName: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const currentTitle =
    navigation.find((item) => item.href && isActivePath(pathname, item.href))
      ?.label ?? "Admin";

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
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-[#0D5C63] text-white transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[84px] items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0D5C63]">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-[13px] font-bold leading-5">Grace & Favour</h1>
              <p className="text-xs text-white/65">School Management</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mx-4 mt-5 rounded-xl border border-white/10 bg-white/[0.07] p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C9A84C] text-[#153F40]">
              <ShieldCheck size={19} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Administrator</p>
              <p className="mt-0.5 text-xs text-white/55">Super Admin access</p>
            </div>
            <ChevronDown size={15} className="ml-auto text-white/50" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.href ? isActivePath(pathname, item.href) : false;

            return (
              <div key={item.label}>
                {item.section && (
                  <p className="mb-2 mt-6 px-3 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                    {item.section}
                  </p>
                )}

                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                      active
                        ? "bg-white text-[#0D5C63] shadow-lg shadow-black/5"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight size={14} className="opacity-60" />}
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/35"
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                      Soon
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/[0.07] p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#A8D832]" />
              <span className="text-xs font-semibold text-white/80">
                Academic session
              </span>
            </div>
            <p className="text-xs font-bold">
              {term ? term.sessionName.replace("/", " / ") : "Not set"}
            </p>
            <p className="mt-1 text-xs text-white/55">
              {term ? term.termName : "Set a current term"}
            </p>
          </div>

          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            <LogOut size={16} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between gap-4 border-b border-[#E8ECE7] bg-white/95 px-4 backdrop-blur-md sm:px-7 xl:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-[#E8ECE7] p-2 text-[#36514C] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <p className="hidden text-xs font-medium text-[#89938E] sm:block">
                Grace & Favour Model School
              </p>
              <h2 className="truncate text-base font-bold text-[#203432] sm:mt-1 sm:text-lg">
                {currentTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCEBE8] text-[#0D5C63]">
              <UserRound size={18} />
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[200px] truncate text-xs font-bold text-[#293D39]">
                {email || "Super Admin"}
              </p>
              <p className="mt-0.5 text-xs text-[#89938E]">Super Admin</p>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
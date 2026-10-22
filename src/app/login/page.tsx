"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginIdentifier } from "@/lib/auth/student-login";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
  ShieldCheck,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const email = resolveLoginIdentifier(identifier);

    if (!email) {
      setError("Enter your email address or your admission number.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError("Incorrect login details. Please try again.");
        return;
      }

      let path = "/unauthorized";

      try {
        const response = await fetch("/api/auth/destination", {
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json()) as { path?: string };
          path = data.path ?? path;
        }
      } catch {
        // Fall back to the unauthorized page if the destination lookup fails.
      }

      router.replace(path);
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#F9F8F4]">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0D5C63] p-12 text-white lg:flex xl:p-16">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-1">
            <SchoolLogo size={40} />
          </div>

          <div>
            <p className="text-lg font-semibold">Grace & Favour</p>
            <p className="text-xs tracking-[0.2em] text-white/70">
              MODEL SCHOOL
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-6 h-1 w-16 rounded-full bg-[#C9A84C]" />

          <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
            A better way to manage your school.
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-white/75">
            One secure place for school administration, student records,
            attendance, academic results, and fee management.
          </p>

          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="h-9 w-9 rounded-full border-2 border-[#0D5C63] bg-[#C9A84C]" />
              <div className="h-9 w-9 rounded-full border-2 border-[#0D5C63] bg-[#A8D832]" />
              <div className="h-9 w-9 rounded-full border-2 border-[#0D5C63] bg-white/80" />
            </div>

            <p className="text-sm text-white/70">
              Designed for your school community
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/50">
          © {new Date().getFullYear()} Grace & Favour Model School
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1">
              <SchoolLogo size={40} />
            </div>

            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              Grace & Favour Model School
            </h1>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0D5C63]">
              Welcome back
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Sign in to your account
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Staff sign in with their email. Students and parents sign in with
              the student&apos;s admission number.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-9 space-y-5">
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email or admission number
              </label>

              <div className="relative">
                <UserRound
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@school.com or GFMS2627001"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#0D5C63] focus:ring-4 focus:ring-[#0D5C63]/10"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
              </div>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm outline-none transition focus:border-[#0D5C63] focus:ring-4 focus:ring-[#0D5C63]/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0D5C63] px-4 text-sm font-semibold text-white transition hover:bg-[#09474D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in securely
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 p-4">
            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-[#0D5C63]"
            />

            <p className="text-xs leading-5 text-slate-500">
              Your school account is managed by an authorized administrator.
              Contact the school if you need help accessing your account.
            </p>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Grace & Favour Model School
          </p>
        </div>
      </section>
    </main>
  );
}
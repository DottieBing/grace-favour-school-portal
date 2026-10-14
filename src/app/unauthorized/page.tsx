
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9F8F4] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">
          Access restricted
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account does not have permission to access this page.
          Please contact the school administrator if you need access.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-[#0D5C63] px-5 py-3 text-sm font-medium text-white hover:bg-[#09474D]"
        >
          Return to login
        </Link>
      </div>
    </main>
  );
}

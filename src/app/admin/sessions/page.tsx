import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateSessionSheet } from "@/components/sessions/create-session-sheet";
import {
  EditTermDatesButton,
  SetCurrentButton,
} from "@/components/sessions/term-actions";

type TermRow = {
  id: string;
  term_number: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type SessionRow = {
  id: string;
  name: string;
  is_current: boolean;
  academic_terms: TermRow[] | null;
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function SessionsContent() {
  const { canManage } = await requireAreaAccess("sessions");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("academic_sessions")
    .select(
      "id, name, is_current, academic_terms(id, term_number, name, start_date, end_date, is_current)",
    )
    .order("name", { ascending: false });

  if (error) {
    console.error("Unable to load sessions:", error.message);
  }

  const sessions = (data ?? []) as SessionRow[];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Academic sessions
          </h1>
          <p className="text-sm text-slate-500">
            Each session has three terms. One term is current at a time.
          </p>
        </div>
        {canManage ? <CreateSessionSheet /> : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn&apos;t load the sessions. Please refresh the page.
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          No sessions yet. Use “New session” to create the first one.
        </div>
      ) : (
        sessions.map((session) => {
          const terms = [...(session.academic_terms ?? [])].sort(
            (a, b) => a.term_number - b.term_number,
          );

          return (
            <section
              key={session.id}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {session.name}
                </h2>
                {session.is_current ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Active session
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {terms.map((term) => (
                  <div
                    key={term.id}
                    className={
                      term.is_current
                        ? "rounded-lg border border-[#0D5C63] bg-[#F1F8F7] p-4"
                        : "rounded-lg border border-slate-200 p-4"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {term.name}
                      </p>
                      {term.is_current ? (
                        <span className="rounded-full bg-[#0D5C63] px-2 py-0.5 text-[10px] font-semibold text-white">
                          Current
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(term.start_date)} to{" "}
                      {formatDate(term.end_date)}
                    </p>

                                        {canManage ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!term.is_current ? (
                        <SetCurrentButton
                          termId={term.id}
                          label={`${term.name} ${session.name}`}
                        />
                      ) : null}
                      <EditTermDatesButton
                        termId={term.id}
                        label={term.name}
                        startDate={term.start_date}
                        endDate={term.end_date}
                      />
                    </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function SessionsFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<SessionsFallback />}>
      <SessionsContent />
    </Suspense>
  );
}
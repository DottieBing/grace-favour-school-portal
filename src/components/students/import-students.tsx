"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  BatchResult,
  PreviewRow,
  ValidationSummary,
} from "@/lib/students/import-schema";

const BATCH_SIZE = 10;

type Stage = "choose" | "preview" | "importing" | "done";

function csvCell(value: string, protect: boolean) {
  let text = value;

  // Stops spreadsheet programs from running a cell as a formula.
  if (protect && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  header: string[],
  rows: string[][],
  rawColumns: number[] = [],
) {
  const lines = [
    header.map((cell) => csvCell(cell, false)).join(","),
    ...rows.map((row) =>
      row.map((cell, index) => csvCell(cell, !rawColumns.includes(index))).join(","),
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportStudents({ classNames }: { classNames: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [stopped, setStopped] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/admin/students/import/validate", {
        method: "POST",
        body: form,
      });

      const data = (await response.json().catch(() => ({}))) as
        | ValidationSummary
        | { error?: string };

      if (!response.ok || !("ready" in data)) {
        setError(
          ("error" in data && data.error) || "Something went wrong. Please try again.",
        );
        return;
      }

      setSummary(data);
      setStage("preview");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport(ready: PreviewRow[]) {
    setStage("importing");
    setProgress(0);
    setResults([]);
    setStopped(null);

    const all: BatchResult[] = [];

    for (let start = 0; start < ready.length; start += BATCH_SIZE) {
      const chunk = ready.slice(start, start + BATCH_SIZE);

      try {
        const response = await fetch("/api/admin/students/import/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: chunk.map(({ rowNumber, row }) => ({ rowNumber, row })),
          }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          results?: BatchResult[];
          error?: string;
        };

        if (!response.ok || !Array.isArray(data.results)) {
          setStopped(data.error ?? "The import stopped unexpectedly.");

          for (const item of ready.slice(start)) {
            all.push({
              rowNumber: item.rowNumber,
              name: item.name,
              status: "failed",
              message: "Not confirmed. Check the Students list before importing again.",
            });
          }

          break;
        }

        all.push(...data.results);
        setProgress(Math.min(start + BATCH_SIZE, ready.length));
      } catch {
        setStopped("Network error. The import stopped.");

        for (const item of ready.slice(start)) {
          all.push({
            rowNumber: item.rowNumber,
            name: item.name,
            status: "failed",
            message: "Not confirmed. Check the Students list before importing again.",
          });
        }

        break;
      }
    }

    setResults(all);
    setStage("done");
  }

  function startOver() {
    setStage("choose");
    setSummary(null);
    setResults([]);
    setStopped(null);
    setError(null);
  }

  function downloadLogins() {
    const created = results.filter((item) => item.status === "created");
    const classByRow = new Map(
      (summary?.ready ?? []).map((item) => [item.rowNumber, item]),
    );

    downloadCsv(
      "student-logins.csv",
      [
        "Admission number (username)",
        "Password",
        "Student",
        "Class",
        "Guardian",
        "Guardian phone",
      ],
      created.map((item) => {
        const source = classByRow.get(item.rowNumber);

        return [
          item.admissionNumber ?? "",
          item.password ?? "",
          item.name,
          source?.className ?? "",
          source?.row.guardianName ?? "",
          source?.row.guardianPhone ?? "",
        ];
      }),
      [1],
    );
  }

  function downloadProblems() {
    const lines: string[][] = [];

    for (const item of summary?.invalid ?? []) {
      lines.push([String(item.rowNumber), item.name, "Not imported", item.errors.join(" ")]);
    }

    for (const item of summary?.existing ?? []) {
      lines.push([String(item.rowNumber), item.name, "Skipped", "Already exists."]);
    }

    for (const item of results.filter((entry) => entry.status !== "created")) {
      lines.push([
        String(item.rowNumber),
        item.name,
        item.status === "skipped" ? "Skipped" : "Failed",
        item.message ?? "",
      ]);
    }

    downloadCsv(
      "import-problems.csv",
      ["Row", "Student", "Outcome", "Reason"],
      lines,
    );
  }

  if (stage === "choose") {
    return (
      <div className="max-w-2xl space-y-6">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">1. Get the template</h2>
          <p className="text-sm text-slate-600">
            Fill in one row per student. The Guide sheet in the Excel template
            explains every column.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/admin/students/import/template?format=xlsx"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <Download className="size-4" />
              Excel template
            </a>
            <a
              href="/api/admin/students/import/template?format=csv"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <Download className="size-4" />
              CSV template
            </a>
          </div>

          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900">Class names you can use</p>
            <p className="mt-1">
              {classNames.length > 0 ? classNames.join(", ") : "No active classes yet."}
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">2. Upload your file</h2>
          <p className="text-sm text-slate-600">
            An .xlsx or .csv file, up to 500 students. Nothing is created until
            you've seen a preview and confirmed.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={onFileChange}
          />

          <Button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="size-4" />
            {busy ? "Checking the file..." : "Choose file"}
          </Button>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (stage === "preview" && summary) {
    const ready = summary.ready;

    return (
      <div className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Rows found", summary.total],
            ["Ready to import", ready.length],
            ["Already exist", summary.existing.length],
            ["Need fixing", summary.invalid.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        {summary.invalid.length > 0 ? (
          <section className="rounded-xl border border-amber-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">
              Rows that need fixing
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              These rows won&apos;t be imported. Fix them in your file and upload
              again later, or import the ready rows now.
            </p>
            <div className="mt-4 max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="py-2 pr-3">Row</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.invalid.map((item) => (
                    <tr key={item.rowNumber} className="border-t border-slate-100 align-top">
                      <td className="py-2 pr-3">{item.rowNumber}</td>
                      <td className="py-2 pr-3">{item.name}</td>
                      <td className="py-2 text-red-700">{item.errors.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {ready.length > 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">
              Ready to import{ready.length > 8 ? " (first 8 shown)" : ""}
            </h2>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2">Session</th>
                </tr>
              </thead>
              <tbody>
                {ready.slice(0, 8).map((item) => (
                  <tr key={item.rowNumber} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{item.rowNumber}</td>
                    <td className="py-2 pr-3">{item.name}</td>
                    <td className="py-2 pr-3">{item.className}</td>
                    <td className="py-2">{item.row.admissionSession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Each student gets a login. The passwords appear only on the next
          screen, where you download them. Keep this page open until you have.
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={ready.length === 0} onClick={() => runImport(ready)}>
            Import {ready.length} student{ready.length === 1 ? "" : "s"}
          </Button>
          <Button type="button" variant="outline" onClick={startOver}>
            Choose another file
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "importing" && summary) {
    const total = summary.ready.length;
    const percent = total === 0 ? 0 : Math.round((progress / total) * 100);

    return (
      <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Importing students...</h2>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#0D5C63] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-slate-600">
          {progress} of {total} processed. Don&apos;t close this page.
        </p>
      </div>
    );
  }

  const created = results.filter((item) => item.status === "created").length;
  const skipped = results.filter((item) => item.status === "skipped").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const problems =
    skipped + failed + (summary?.invalid.length ?? 0) + (summary?.existing.length ?? 0);

  return (
    <div className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Import finished</h2>

      {stopped ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {stopped} Students already created are kept. Run the import again
          and they&apos;ll be skipped.
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="text-2xl font-semibold text-emerald-700">{created}</div>
          <div className="text-xs text-emerald-700">Created</div>
        </div>
        <div className="rounded-lg bg-slate-100 p-3">
          <div className="text-2xl font-semibold text-slate-700">{skipped}</div>
          <div className="text-xs text-slate-600">Skipped</div>
        </div>
        <div className="rounded-lg bg-red-50 p-3">
          <div className="text-2xl font-semibold text-red-700">{failed}</div>
          <div className="text-xs text-red-700">Failed</div>
        </div>
      </div>

      {created > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Download the login sheet now. The passwords can&apos;t be shown again.
          It contains every new student&apos;s username and password, so keep it
          safe and delete it after handing the logins out.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {created > 0 ? (
          <Button type="button" onClick={downloadLogins} className="gap-2">
            <Download className="size-4" />
            Download login sheet
          </Button>
        ) : null}
        {problems > 0 ? (
          <Button type="button" variant="outline" onClick={downloadProblems}>
            Download problem report
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={startOver}>
          Import another file
        </Button>
        <Link
          href="/admin/students"
          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          View students
        </Link>
      </div>
    </div>
  );
}
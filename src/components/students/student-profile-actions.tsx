"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ApiError = { error?: string };

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export type StudentStatus = "active" | "withdrawn" | "transferred" | "graduated";

const STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  transferred: "Transferred",
  graduated: "Graduated",
};

export function ChangeStatusButton({
  studentId,
  name,
  status,
}: {
  studentId: string;
  name: string;
  status: StudentStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<StudentStatus>(status);

  async function confirm() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/students/${studentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiError;

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setNext(status);
          setError(null);
          setOpen(true);
        }}
      >
        Change status
      </Button>

      <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status for {name}</DialogTitle>
            <DialogDescription>
              Any status other than Active blocks the student&apos;s login. Their
              records stay, and you can set them back to Active anytime.
            </DialogDescription>
          </DialogHeader>

          <select
            className={selectClass}
            value={next}
            onChange={(event) => setNext(event.target.value as StudentStatus)}
            aria-label="New status"
          >
            {(Object.keys(STATUS_LABELS) as StudentStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={next === "active" ? "default" : "destructive"}
              onClick={confirm}
              disabled={saving || next === status}
            >
              {saving ? "Saving..." : "Save status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type ClassChoice = {
  id: string;
  name: string;
  count: number;
  capacity: number | null;
};

export function ChangeClassButton({
  studentId,
  name,
  currentClassId,
  classes,
  disabled,
}: {
  studentId: string;
  name: string;
  currentClassId: string | null;
  classes: ClassChoice[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");

  const target = classes.find((item) => item.id === classId);
  const overCapacity =
    target && target.capacity ? target.count >= target.capacity : false;

  async function confirm() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/students/${studentId}/class`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiError;

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setClassId("");
          setError(null);
          setOpen(true);
        }}
      >
        Change class
      </Button>

      <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {name} to another class</DialogTitle>
            <DialogDescription>
              Past results and attendance stay with the class they were recorded
              in.
            </DialogDescription>
          </DialogHeader>

          <select
            className={selectClass}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            aria-label="New class"
          >
            <option value="">Choose a class...</option>
            {classes
              .filter((item) => item.id !== currentClassId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.count}
                  {item.capacity ? `/${item.capacity}` : ""})
                </option>
              ))}
          </select>

          {overCapacity ? (
            <p className="text-sm text-amber-700">
              This class is already at capacity. You can still move the
              student.
            </p>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={saving || !classId}
            >
              {saving ? "Moving..." : "Move student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResetStudentPasswordButton({
  studentId,
  name,
  admissionNumber,
  disabled,
}: {
  studentId: string;
  name: string;
  admissionNumber: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function close() {
    if (saving) return;
    setOpen(false);
    setPassword(null);
    setError(null);
    setCopied(false);
  }

  async function reset() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/students/${studentId}/password`, {
        method: "POST",
      });

      const data = (await response.json().catch(() => ({}))) as ApiError & {
        password?: string;
      };

      if (!response.ok || !data.password) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setPassword(data.password);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLogin() {
    if (!password) return;
    await navigator.clipboard.writeText(
      `Admission number: ${admissionNumber}\nPassword: ${password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setError(null);
          setPassword(null);
          setOpen(true);
        }}
      >
        Reset password
      </Button>

      <Dialog open={open} onOpenChange={(value) => !value && close()}>
        <DialogContent>
          {password ? (
            <>
              <DialogHeader>
                <DialogTitle>New password for {name}</DialogTitle>
                <DialogDescription>
                  Copy this now. It can&apos;t be shown again after you close
                  this window.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">
                    Admission number (username)
                  </div>
                  <div className="font-mono text-slate-900">
                    {admissionNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">New password</div>
                  <div className="break-all font-mono text-slate-900">
                    {password}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyLogin}
                  className="gap-2"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy login details"}
                </Button>
                <Button type="button" onClick={close}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Reset password for {name}?</DialogTitle>
                <DialogDescription>
                  A new password will be generated and the old one will stop
                  working. You&apos;ll see the new password once.
                </DialogDescription>
              </DialogHeader>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={reset} disabled={saving}>
                  {saving ? "Resetting..." : "Reset password"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
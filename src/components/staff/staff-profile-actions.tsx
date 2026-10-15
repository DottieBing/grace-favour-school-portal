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

export function StatusButton({
  staffId,
  name,
  isActive,
  hasLogin,
  disabled,
}: {
  staffId: string;
  name: string;
  isActive: boolean;
  hasLogin: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deactivating = isActive;

  async function confirm() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/staff/${staffId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
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
        variant={deactivating ? "destructive" : "default"}
        disabled={disabled}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {deactivating ? "Deactivate staff" : "Reactivate staff"}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deactivating ? "Deactivate" : "Reactivate"} {name}?
            </DialogTitle>
            <DialogDescription>
              {deactivating
                ? hasLogin
                  ? "They won't be able to sign in. Their records stay in the system and you can reactivate them anytime."
                  : "They'll be marked inactive. Their record stays in the system and you can reactivate them anytime."
                : hasLogin
                  ? "They'll be able to sign in again."
                  : "They'll be marked active again."}
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
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={deactivating ? "destructive" : "default"}
              onClick={confirm}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : deactivating
                  ? "Deactivate"
                  : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResetPasswordButton({
  staffId,
  name,
  email,
  disabled,
}: {
  staffId: string;
  name: string;
  email: string;
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
      const response = await fetch(`/api/admin/staff/${staffId}/password`, {
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
      `Email: ${email}\nPassword: ${password}`,
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

      <Dialog open={open} onOpenChange={(next) => !next && close()}>
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
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="break-all font-mono text-slate-900">
                    {email}
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
                  A new password will be generated and their old one will stop
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
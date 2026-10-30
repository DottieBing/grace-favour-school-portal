"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LogoUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("logo", file);

      const response = await fetch("/api/admin/settings/logo", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setVersion(Date.now());
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/logo?v=${version}`}
          alt="School logo"
          className="size-full object-contain"
        />
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onChange}
        />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading..." : "Upload new logo"}
        </Button>
        <p className="text-xs text-slate-500">
          PNG, JPG or WebP, up to 2 MB. A transparent PNG looks best. Other pages pick it up within a minute.
        </p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function StudentPhoto({
  studentId,
  name,
  photoUrl,
  canEdit = true,
}: {
  studentId: string;
  name: string;
  photoUrl: string | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("photo", file);

      const response = await fetch(`/api/admin/students/${studentId}/photo`, {
        method: "POST",
        body: form,
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-[#DCEBE8] text-3xl font-bold text-[#0D5C63]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`Photo of ${name}`}
            className="size-full object-cover"
          />
        ) : (
          initialsOf(name)
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          <Camera className="size-4" />
          {uploading ? "Uploading..." : photoUrl ? "Change photo" : "Upload photo"}
        </Button>
      ) : null}

      {error ? (
        <p className="max-w-[200px] text-center text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export const LOGO_SRC = "/logo.svg";

export function SchoolLogo({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ShieldCheck size={Math.round(size * 0.6)} className="text-[#0D5C63]" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="Grace & Favour Model School logo"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
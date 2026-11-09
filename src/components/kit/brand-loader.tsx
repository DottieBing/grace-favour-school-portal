"use client";

import { useEffect, useState } from "react";

import { SchoolLogo } from "@/components/brand/school-logo";

const MESSAGES = [
  "Getting things ready...",
  "Opening your dashboard...",
  "Sharpening the pencils...",
  "Setting up your classroom...",
  "Almost there...",
];

export function BrandLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % MESSAGES.length);
    }, 2200);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-7 bg-[#F4F7F5] ${
        fullScreen ? "min-h-screen" : "min-h-[55vh]"
      }`}
    >
      <div className="relative flex size-28 items-center justify-center">
        <span className="loader-glow absolute inset-0 rounded-full bg-[#0D5C63]/25 blur-xl" />
        <span className="loader-ring absolute inset-0 rounded-full" />
        <span className="loader-ring-slow absolute inset-3 rounded-full" />
        <span className="loader-breathe relative flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg shadow-[#0D5C63]/15">
          <SchoolLogo size={48} />
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p key={index} className="anim-fade-up text-sm font-medium text-[#53645D]">
          {MESSAGES[index]}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="loader-dot size-2 rounded-full bg-[#0D5C63]"
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
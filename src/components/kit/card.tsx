import type { ReactNode } from "react";

export function Card({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <section
      className={`anim-fade-up rounded-2xl border border-black/5 bg-white p-5 shadow-sm ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}
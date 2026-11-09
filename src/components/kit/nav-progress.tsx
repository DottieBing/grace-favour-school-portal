"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** A thin bar across the top that starts on a link click and finishes when the page arrives. */
export function NavProgress() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const progress = useRef(0);
  const running = useRef(false);

  const paint = useCallback((width: number, opacity: number, animate: boolean) => {
    const element = bar.current;

    if (!element) return;

    element.style.transition = animate ? "width 0.3s ease, opacity 0.4s ease" : "none";
    element.style.width = `${width}%`;
    element.style.opacity = String(opacity);
  }, []);

  const clear = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);

    ticker.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (!running.current) return;

    running.current = false;
    clear();
    paint(100, 1, true);

    timers.current.push(
      setTimeout(() => paint(100, 0, true), 250),
      setTimeout(() => paint(0, 0, false), 700),
    );
  }, [clear, paint]);

  const start = useCallback(() => {
    clear();
    running.current = true;
    progress.current = 8;
    paint(8, 1, false);

    ticker.current = setInterval(() => {
      progress.current += (90 - progress.current) * 0.08;
      paint(progress.current, 1, true);
    }, 250);

    // Never leave the bar hanging if something goes wrong.
    timers.current.push(setTimeout(finish, 15000));
  }, [clear, finish, paint]);

  useEffect(() => {
    finish();
  }, [pathname, finish]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const link = (event.target as HTMLElement).closest("a");

      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) {
        return;
      }

      const url = new URL(link.href, window.location.href);

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    }

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      clear();
    };
  }, [start, clear]);

  return (
    <div
      ref={bar}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[70] h-[3px] bg-gradient-to-r from-[#0D5C63] via-[#0D5C63] to-[#C9A84C]"
      style={{ width: 0, opacity: 0 }}
    />
  );
}
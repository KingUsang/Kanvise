"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_WAIT_MS = 15_000;

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  const visibleRef = useRef(false);
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    intervalRef.current = null;
    safetyTimerRef.current = null;
    hideTimerRef.current = null;
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      visibleRef.current = false;
      setProgress(0);
    }, 180);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    visibleRef.current = true;
    setVisible(true);
    setProgress(18);
    intervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(90, current + Math.max(1, (90 - current) * 0.12)));
    }, 220);
    safetyTimerRef.current = setTimeout(finish, MAX_WAIT_MS);
  }, [clearTimers, finish]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;
      start();
    };

    const handlePopState = () => start();
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [clearTimers, start]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (visibleRef.current) finish();
  }, [routeKey, finish]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-1 bg-black/10"
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="relative h-full bg-gradient-to-r from-[#f59e0b] via-[#c26627] to-[#2e2877] shadow-[0_1px_4px_rgba(255,255,255,0.9),0_0_14px_rgba(194,102,39,0.9)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      >
        <span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_3px_rgba(245,158,11,0.9)]" />
      </div>
    </div>
  );
}

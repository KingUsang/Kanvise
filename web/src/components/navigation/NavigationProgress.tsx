"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TopProgressLine } from "@/components/ui/skeleton";

const MAX_WAIT_MS = 15_000;
const NAVIGATION_START_EVENT = "kanvise:navigation-start";

export function startNavigationProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
  }
}

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
  const routeKeyRef = useRef(routeKey);
  routeKeyRef.current = routeKey;

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

    const handleProgrammaticStart = () => start();
    const handlePopState = () => {
      const destinationKey = `${window.location.pathname}?${window.location.search.slice(1)}`;
      start();

      // A browser history entry may be restored from Next.js' router cache
      // before popstate reaches this listener. In that case there will be no
      // later pathname effect to finish the bar, so finish on the next frame.
      window.requestAnimationFrame(() => {
        if (routeKeyRef.current === destinationKey && visibleRef.current) finish();
      });
    };
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener(NAVIGATION_START_EVENT, handleProgrammaticStart);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(NAVIGATION_START_EVENT, handleProgrammaticStart);
      clearTimers();
    };
  }, [clearTimers, finish, start]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (visibleRef.current) finish();
  }, [routeKey, finish]);

  if (!visible) return null;

  return <TopProgressLine progress={progress} position="fixed" />;
}

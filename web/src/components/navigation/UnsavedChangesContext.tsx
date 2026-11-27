"use client";

import React, { createContext, useContext, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, useDialogIds } from "@/components/ui/dialog";
import { startNavigationProgress } from "./NavigationProgress";

interface UnsavedChangesContextType {
  setDirty: (sourceId: string, isDirty: boolean) => void;
  /** Runs `action` now when nothing is dirty; otherwise asks the user first. */
  guardNavigation: (action: () => void) => void;
}

type PendingLeave = { kind: "url"; url: string } | { kind: "action"; run: () => void } | { kind: "history" };

/** Pure helper: returns a new set with the source added or removed. */
export function updateDirtySources(sources: ReadonlySet<string>, sourceId: string, isDirty: boolean): ReadonlySet<string> {
  if (sources.has(sourceId) === isDirty) return sources;
  const next = new Set(sources);
  if (isDirty) next.add(sourceId);
  else next.delete(sourceId);
  return next;
}

const GUARD_KEY = "__kanviseUnsavedGuard";

function hasGuardMarker(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[GUARD_KEY] === true;
}

/**
 * Adds one marked duplicate history entry so Back/Forward stay on this page and we can ask first.
 * The entry is reused when the current entry is already marked, so repeated dirty/clean cycles
 * (for example after saving) never grow the history stack. `force` re-pushes after a Back pop.
 * Returns true when an entry was pushed.
 */
export function pushGuardEntry(force = false, win: Window = window): boolean {
  if (!force && hasGuardMarker(win.history.state)) return false;
  const base = typeof win.history.state === "object" && win.history.state !== null ? win.history.state : {};
  win.history.pushState({ ...base, [GUARD_KEY]: true }, "", win.location.href);
  return true;
}

/** Steps for history.go when leaving by Back: the guard entry above the page, then the page entry. */
export function historyLeaveSteps(): number {
  return -2;
}

/**
 * Leaves the page through history: back over the guard entry and the page entry.
 * When the page was the first entry (direct arrival, new tab) there is nothing to go back to,
 * so `go(-2)` is a no-op. In that case `fallback` runs after `waitMs` without a popstate.
 */
export function leaveByHistory(fallback: () => void, win: Window = window, waitMs = 1000): void {
  let moved = false;
  const onPop = () => {
    moved = true;
  };
  win.addEventListener("popstate", onPop, { once: true });
  win.addEventListener("pagehide", onPop, { once: true });
  win.history.go(historyLeaveSteps());
  win.setTimeout(() => {
    win.removeEventListener("popstate", onPop);
    win.removeEventListener("pagehide", onPop);
    if (!moved) fallback();
  }, waitMs);
}

/** Where to send someone who arrived directly on an editor and chose to leave without history to return to. */
export const DIRECT_ARRIVAL_FALLBACK = "/dashboard";

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  setDirty: () => {},
  guardNavigation: (action) => action(),
});

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirtySources, setDirtySources] = useState<ReadonlySet<string>>(() => new Set());
  const isDirty = dirtySources.size > 0;
  const setDirty = React.useCallback((sourceId: string, dirty: boolean) => {
    setDirtySources(current => updateDirtySources(current, sourceId, dirty));
  }, []);
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const router = useRouter();
  const dirtyRef = React.useRef(false);
  const { titleId, descriptionId } = useDialogIds();
  useEffect(() => {
    dirtyRef.current = isDirty;
    if (isDirty) pushGuardEntry();
  }, [isDirty]);
  const guardNavigation = React.useCallback((action: () => void) => {
    if (dirtyRef.current) setPending({ kind: "action", run: action });
    else action();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handlePopState = () => {
      if (!dirtyRef.current) return;
      // Put the guard entry back so the URL does not change, then ask.
      pushGuardEntry(true);
      setPending({ kind: "history" });
    };

    const handleClick = (event: MouseEvent) => {
      if (!isDirty) return;
      
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;
      
      // Stop the click from navigating
      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "url", url: destination.href });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    // Use capture phase to intercept before Next.js Link does
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);

  const confirmLeave = () => {
    const leave = pending;
    dirtyRef.current = false;
    setDirtySources(new Set());
    setPending(null);
    if (!leave) return;
    if (leave.kind === "history") {
      leaveByHistory(() => {
        startNavigationProgress();
        router.push(DIRECT_ARRIVAL_FALLBACK);
      });
      return;
    }
    startNavigationProgress();
    if (leave.kind === "url") router.push(leave.url);
    else leave.run();
  };

  const cancelLeave = () => {
    setPending(null);
  };

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, guardNavigation }}>
      {children}
      {pending && (
        <Dialog labelledBy={titleId} describedBy={descriptionId} onClose={cancelLeave}>
          <h2 id={titleId} className="text-lg font-bold text-[#1b1c1c]">Unsaved changes</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-[#474551]">
            You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" data-autofocus onClick={cancelLeave} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#474551] hover:bg-[#f5f3f2]">
              Stay here
            </button>
            <button type="button" onClick={confirmLeave} className="rounded-lg bg-[#ba1a1a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#931515]">
              Discard changes and leave
            </button>
          </div>
        </Dialog>
      )}
    </UnsavedChangesContext.Provider>
  );
}

/** Router whose push/replace ask for confirmation while any editor has unsaved changes. */
export function useGuardedRouter() {
  const router = useRouter();
  const { guardNavigation } = useContext(UnsavedChangesContext);
  return React.useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => guardNavigation(() => router.push(href, options)),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => guardNavigation(() => router.replace(href, options)),
    }),
    [router, guardNavigation],
  );
}

export function useUnsavedChanges(isDirty: boolean) {
  const { setDirty } = useContext(UnsavedChangesContext);
  const sourceId = useId();

  useEffect(() => {
    setDirty(sourceId, isDirty);
    return () => setDirty(sourceId, false);
  }, [isDirty, setDirty, sourceId]);
}

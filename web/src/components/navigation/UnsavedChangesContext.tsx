"use client";

import React, { createContext, useContext, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "./NavigationProgress";

interface UnsavedChangesContextType {
  setDirty: (sourceId: string, isDirty: boolean) => void;
}

/** Pure helper: returns a new set with the source added or removed. */
export function updateDirtySources(sources: ReadonlySet<string>, sourceId: string, isDirty: boolean): ReadonlySet<string> {
  if (sources.has(sourceId) === isDirty) return sources;
  const next = new Set(sources);
  if (isDirty) next.add(sourceId);
  else next.delete(sourceId);
  return next;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  setDirty: () => {},
});

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirtySources, setDirtySources] = useState<ReadonlySet<string>>(() => new Set());
  const isDirty = dirtySources.size > 0;
  const setDirty = React.useCallback((sourceId: string, dirty: boolean) => {
    setDirtySources(current => updateDirtySources(current, sourceId, dirty));
  }, []);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
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
      setPendingUrl(destination.href);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    // Use capture phase to intercept before Next.js Link does
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);

  const confirmLeave = () => {
    setDirtySources(new Set());
    if (pendingUrl) {
      startNavigationProgress();
      router.push(pendingUrl);
      setPendingUrl(null);
    }
  };

  const cancelLeave = () => {
    setPendingUrl(null);
  };

  return (
    <UnsavedChangesContext.Provider value={{ setDirty }}>
      {children}
      {pendingUrl && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#1b1c1c]">Unsaved changes</h2>
            <p className="mt-2 text-sm leading-6 text-[#474551]">
              You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={cancelLeave} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#474551] hover:bg-[#f5f3f2]">
                Stay here
              </button>
              <button onClick={confirmLeave} className="rounded-lg bg-[#ba1a1a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#931515]">
                Discard changes and leave
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
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

"use client";

import React, { useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Pure helper: the next focus index when Tab wraps inside a trap. Returns null when the browser should move focus itself. */
export function nextTrapIndex(count: number, activeIndex: number, shift: boolean): number | null {
  if (count === 0) return -1;
  if (shift && activeIndex <= 0) return count - 1;
  if (!shift && activeIndex === count - 1) return 0;
  return null;
}

interface DialogProps {
  /** Accessible name. Use `labelledBy` instead when a visible heading exists. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  /** Called on Escape and on backdrop click. Omit to make the dialog non-dismissable. */
  onClose?: () => void;
  className?: string;
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared modal dialog: role/aria-modal, focus moved in on open, Tab trapped,
 * Escape closes, focus restored to the previously focused element on close.
 */
export function Dialog({ label, labelledBy, describedBy, onClose, className, panelClassName, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const target = nextTrapIndex(items.length, items.indexOf(document.activeElement as HTMLElement), event.shiftKey);
      if (target === null && panel.contains(document.activeElement)) return;
      event.preventDefault();
      (target === null || target < 0 ? panel : items[target]).focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  return (
    <div
      className={className ?? "fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={panelClassName ?? "w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none"}
      >
        {children}
      </div>
    </div>
  );
}

/** Stable ids for a dialog's heading and description. */
export function useDialogIds() {
  const id = useId();
  return { titleId: `${id}-title`, descriptionId: `${id}-description` };
}

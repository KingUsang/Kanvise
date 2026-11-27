"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Pure helper: the next focus index when Tab wraps inside a trap. Returns null when the browser should move focus itself. */
export function nextTrapIndex(count: number, activeIndex: number, shift: boolean): number | null {
  if (count === 0) return -1;
  if (shift && activeIndex <= 0) return count - 1;
  if (!shift && activeIndex === count - 1) return 0;
  return null;
}

/**
 * Marks every other direct child of <body> inert so focus, clicks and assistive tech stay inside the dialog.
 * Returns a restore function that only clears the attributes it set.
 */
export function inertSiblings(root: HTMLElement, body: HTMLElement = document.body): () => void {
  const changed: Element[] = [];
  for (const child of Array.from(body.children)) {
    if (child === root || child.contains(root) || child.hasAttribute("inert")) continue;
    if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
    child.setAttribute("inert", "");
    changed.push(child);
  }
  return () => {
    for (const child of changed) child.removeAttribute("inert");
  };
}

/** Mounted dialogs, oldest first. Only the last one handles Escape and Tab. */
const dialogStack: symbol[] = [];
export function pushDialog(token: symbol) {
  dialogStack.push(token);
}
export function removeDialog(token: symbol) {
  const index = dialogStack.indexOf(token);
  if (index >= 0) dialogStack.splice(index, 1);
}
export function isTopDialog(token: symbol) {
  return dialogStack[dialogStack.length - 1] === token;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const token = Symbol("dialog");
    pushDialog(token);
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreInert = rootRef.current ? inertSiblings(rootRef.current) : () => {};
    const first = panel?.querySelector<HTMLElement>("[data-autofocus], [data-dialog-initial-focus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog(token)) return;
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
      removeDialog(token);
      restoreInert();
      document.body.style.overflow = previousOverflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={rootRef}
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
    </div>,
    document.body,
  );
}

/** Stable ids for a dialog's heading and description. */
export function useDialogIds() {
  const id = useId();
  return { titleId: `${id}-title`, descriptionId: `${id}-description` };
}

"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton } from "@/components/dashboard/action-controls";

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
    // Keep toast regions live so errors raised from inside a dialog stay interactive and announced.
    if (child.hasAttribute("data-keep-interactive") || child.matches('[aria-label^="Notifications"]') || child.querySelector('[aria-label^="Notifications"]')) continue;
    child.setAttribute("inert", "");
    changed.push(child);
  }
  return () => {
    for (const child of changed) child.removeAttribute("inert");
  };
}

/** Mounted dialogs, oldest first. Only the last one handles Escape and Tab. */
const dialogStack: symbol[] = [];
const dialogRoots = new Map<symbol, HTMLElement>();
/**
 * Only the top dialog is visible, with a single scrim (as in Bobbin, where a
 * dialog opened from a wizard replaces it on screen). Covered dialogs stay
 * mounted, hidden with `data-covered`, so typed data and focus targets survive.
 */
function syncCovered() {
  dialogStack.forEach((token, index) => {
    const root = dialogRoots.get(token);
    if (!root) return;
    if (index < dialogStack.length - 1) root.setAttribute("data-covered", "");
    else root.removeAttribute("data-covered");
  });
}
export function pushDialog(token: symbol, root?: HTMLElement | null) {
  dialogStack.push(token);
  if (root) dialogRoots.set(token, root);
  syncCovered();
}
export function removeDialog(token: symbol) {
  const index = dialogStack.indexOf(token);
  if (index >= 0) dialogStack.splice(index, 1);
  dialogRoots.delete(token);
  syncCovered();
}
export function isTopDialog(token: symbol) {
  return dialogStack[dialogStack.length - 1] === token;
}

/**
 * Phone Back gesture for sheets. A sheet pushes one history entry when it
 * opens; Back pops it and closes the top-most sheet instead of leaving the
 * page. When a sheet closes by any other route its entry is popped again, and
 * that pop is ignored. The current history state is copied so the Next.js
 * router still recognises the entry.
 */
type BackEntry = { token: symbol; close: () => boolean | void; pushed: boolean; href: string; navigating: boolean };
const backStack: BackEntry[] = [];
/** Pops this module asked for. Each expires after a short wait so a pop that never arrives cannot swallow a real Back. */
let ignoredPops: symbol[] = [];
const IGNORED_POP_TTL_MS = 1000;
let backListening = false;

function onPopState() {
  if (ignoredPops.length > 0) {
    ignoredPops.shift();
    return;
  }
  const top = backStack[backStack.length - 1];
  if (!top || !top.pushed) return;
  // The browser already popped the entry; closing must not pop it again.
  top.pushed = false;
  // A guard (unsaved changes, busy) can refuse: the dialog stays, so it gets its entry back.
  if (top.close() === false) pushBackEntry(top);
}

/** Test helper: forget pops that a mocked history.back() never delivered. */
export function resetBackHandlingForTests() {
  backStack.length = 0;
  ignoredPops = [];
}

function pushBackEntry(entry: BackEntry) {
  entry.pushed = true;
  window.history.pushState({ ...(window.history.state ?? {}), kanviseSheet: true }, "", window.location.href);
}

function registerBack(token: symbol, close: () => boolean | void): { unregister: () => void; markNavigating: () => void } {
  const entry: BackEntry = { token, close, pushed: false, href: window.location.href, navigating: false };
  backStack.push(entry);
  if (!backListening) {
    window.addEventListener("popstate", onPopState);
    backListening = true;
  }
  pushBackEntry(entry);
  const unregister = () => {
    const index = backStack.indexOf(entry);
    if (index >= 0) backStack.splice(index, 1);
    if (entry.pushed) {
      entry.pushed = false;
      // Closed because a link inside was clicked: the route change commits after this unmount, so popping now
      // would race it and can restore the old page. Leave the spare entry; Back passes through it.
      // Also skip when navigation already committed or the current entry is not ours, since back() would then leave the page.
      const stillOnOwnEntry = window.location.href === entry.href && Boolean((window.history.state as { kanviseSheet?: boolean } | null)?.kanviseSheet);
      if (stillOnOwnEntry && !entry.navigating) {
        const mark = Symbol("ignored-pop");
        ignoredPops.push(mark);
        setTimeout(() => {
          ignoredPops = ignoredPops.filter((m) => m !== mark);
        }, IGNORED_POP_TTL_MS);
        window.history.back();
      }
    }
    if (backStack.length === 0 && backListening) {
      window.removeEventListener("popstate", onPopState);
      backListening = false;
    }
  };
  return { unregister, markNavigating: () => { entry.navigating = true; } };
}

interface DialogProps {
  /** Phone Back gesture closes this dialog (sheets). Needs `onClose`. */
  closeOnBack?: boolean;
  /** What Back does instead of `onClose`. Return false when a guard keeps the dialog open. */
  onBack?: () => boolean | void;
  /** Accessible name. Use `labelledBy` instead when a visible heading exists. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  /** Called on Escape and on backdrop click. Omit to make the dialog non-dismissable. */
  onClose?: () => void;
  /** Set false to ignore backdrop clicks (Escape still closes). Use where input would be lost. */
  dismissOnBackdrop?: boolean;
  className?: string;
  panelClassName?: string;
  /** `alertdialog` for confirmations that interrupt the task. */
  role?: "dialog" | "alertdialog";
  /** Extra data attribute for styling hooks and tests. */
  layout?: string;
  children: React.ReactNode;
}

/**
 * Shared modal dialog: role/aria-modal, focus moved in on open, Tab trapped,
 * Escape closes, focus restored to the previously focused element on close.
 */
export function Dialog({ closeOnBack = false, onBack, label, labelledBy, describedBy, onClose, dismissOnBackdrop = true, className, panelClassName, role = "dialog", layout, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onCloseRef.current = onClose;
    onBackRef.current = onBack;
  }, [onClose, onBack]);

  useEffect(() => {
    const token = Symbol("dialog");
    pushDialog(token, rootRef.current);
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
    const back = closeOnBack && onCloseRef.current ? registerBack(token, () => (onBackRef.current ? onBackRef.current() : onCloseRef.current?.())) : null;
    const root = rootRef.current;
    const onLinkClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (link && !link.hasAttribute("download") && link.getAttribute("target") !== "_blank") back?.markNavigating();
    };
    if (back) root?.addEventListener("click", onLinkClick);
    return () => {
      root?.removeEventListener("click", onLinkClick);
      back?.unregister();
      document.removeEventListener("keydown", onKeyDown, true);
      removeDialog(token);
      restoreInert();
      document.body.style.overflow = previousOverflow;
      if (previous && document.contains(previous)) previous.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per mount
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={rootRef}
      className={className ?? "fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"}
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        data-layout={layout}
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

/** Why a dialog is being asked to close. */
export type DialogCloseReason = "dismiss" | "close-button";

const scrimClassName = "animate-dashboard-scrim-in fixed inset-0 z-[99999] flex items-center justify-center bg-dashboard-scrim p-4 backdrop-blur-sm";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** One line under the title (SH-10). */
  subtitle: React.ReactNode;
  children: React.ReactNode;
  /** Buttons. On phones they sit fixed at the bottom of the sheet, full width. */
  footer?: React.ReactNode;
  /** Content between the subtitle and the body, for example WizardProgress. */
  headerExtra?: React.ReactNode;
  /** 480px (default) or 640px wide on desktop. */
  size?: "md" | "lg";
  /**
   * Guard for unsaved changes. Return false to keep the dialog open (and ask
   * the person first, for example with an AlertDialog). Called with
   * "dismiss" for Escape and backdrop clicks, "close-button" for the X.
   */
  onRequestClose?: (reason: DialogCloseReason) => boolean;
  /** While true the dialog cannot be dismissed. */
  busy?: boolean;
  closeLabel?: string;
  /**
   * Below 768px: `sheet` (default) becomes a full-screen sheet that slides up
   * with the close button on the left of a top bar (R-05).
   */
  phoneLayout?: "sheet" | "centred";
}

/**
 * The redesign dialog (SH-10, R-05): centred 480-640px panel with 16px radius
 * over a dimmed, blurred page; title, subtitle and close button; focus trap
 * and restore from the base Dialog; Escape asks `onRequestClose` first.
 */
export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerExtra,
  size = "md",
  onRequestClose,
  busy = false,
  closeLabel = "Close",
  phoneLayout = "sheet",
}: ModalDialogProps) {
  const { titleId, descriptionId } = useDialogIds();
  if (!open) return null;
  const requestClose = (reason: DialogCloseReason) => {
    if (busy) return false;
    if (onRequestClose && onRequestClose(reason) === false) return false;
    onClose();
    return true;
  };
  const sheet = phoneLayout === "sheet";
  const width = size === "lg" ? "md:max-w-[640px]" : "md:max-w-[480px]";
  return (
    <Dialog
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={() => { requestClose("dismiss"); }}
      layout={sheet ? "sheet" : "centred"}
      closeOnBack
      onBack={() => requestClose("dismiss")}
      className={sheet ? `${scrimClassName} max-md:p-0` : scrimClassName}
      panelClassName={[
        "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-dashboard-dialog bg-dashboard-surface shadow-dashboard-overlay outline-none",
        "animate-dashboard-dialog-in",
        width,
        sheet
          ? "max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:rounded-none max-md:animate-dashboard-sheet-up"
          : "max-w-[480px] min-w-[min(320px,100%)]",
      ].join(" ")}
    >
      <header className={`flex items-start gap-3 px-6 pt-6 ${sheet ? "max-md:border-b max-md:border-dashboard-outline max-md:px-4 max-md:py-2 max-md:pt-[calc(0.5rem+env(safe-area-inset-top))]" : ""}`}>
        <IconButton
          variant="quiet"
          label={closeLabel}
          onClick={() => requestClose("close-button")}
          disabled={busy}
          className={sheet ? "-mr-1 -mt-2 shrink-0 md:order-last max-md:-ml-2 max-md:mr-0 max-md:mt-0" : "-mr-2 -mt-2 order-last shrink-0"}
        >
          <X aria-hidden="true" className="size-5" />
        </IconButton>
        <div className={`min-w-0 flex-1 ${sheet ? "max-md:flex max-md:min-h-11 max-md:items-center" : ""}`}>
          <h2 id={titleId} className="text-xl font-bold text-dashboard-foreground max-md:text-dashboard-section-title">{title}</h2>
          <p id={descriptionId} className={`mt-1 text-dashboard-small text-dashboard-muted ${sheet ? "max-md:sr-only" : ""}`}>{subtitle}</p>
        </div>
      </header>
      {sheet ? <p aria-hidden="true" className="px-4 pt-3 text-dashboard-small text-dashboard-muted md:hidden">{subtitle}</p> : null}
      {headerExtra ? <div className="px-6 pt-4 max-md:px-4">{headerExtra}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-md:px-4">{children}</div>
      {footer ? (
        <footer
          data-dialog-footer=""
          className={[
            "flex flex-wrap items-center justify-end gap-3 border-t border-dashboard-outline px-6 py-4",
            sheet
              ? "max-md:flex-col-reverse max-md:items-stretch max-md:px-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))] max-md:[&>*]:w-full"
              : "max-md:flex-col-reverse max-md:items-stretch max-md:[&>*]:w-full",
          ].join(" ")}
        >
          {footer}
        </footer>
      ) : null}
    </Dialog>
  );
}

interface AlertDialogProps {
  open: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Danger for destructive actions (Delete, Sign out anyway). */
  tone?: "danger" | "primary";
  pending?: boolean;
}

/**
 * Small confirmation (R-05): always centred, at least 320px wide, buttons
 * stacked full width on phones. Escape and the backdrop cancel. Focus starts
 * on the safe choice.
 */
export function AlertDialog({ open, title, description, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel, tone = "danger", pending = false }: AlertDialogProps) {
  const { titleId, descriptionId } = useDialogIds();
  if (!open) return null;
  return (
    <Dialog
      role="alertdialog"
      layout="alert"
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={pending ? undefined : onCancel}
      dismissOnBackdrop={!pending}
      className={scrimClassName}
      panelClassName="animate-dashboard-dialog-in w-full min-w-[min(320px,100%)] max-w-[480px] rounded-dashboard-dialog bg-dashboard-surface p-6 shadow-dashboard-overlay outline-none"
    >
      <h2 id={titleId} className="text-dashboard-section-title font-bold text-dashboard-foreground">{title}</h2>
      <p id={descriptionId} className="mt-2 text-dashboard-small text-dashboard-muted">{description}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending} data-autofocus="" className="max-md:w-full">{cancelLabel}</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} pending={pending} className="max-md:w-full">{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

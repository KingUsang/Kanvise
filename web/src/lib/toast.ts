import { toast as sonner } from 'sonner'

/**
 * Toast rules from 01-app-shell SH-08:
 * - one toast at a time; a new toast replaces the current one, except an
 *   action (Undo) toast, which a new plain toast waits behind;
 * - success and info toasts last 4 seconds (the Toaster pauses them on hover
 *   and focus);
 * - an Undo toast stays until it is dismissed, Undo is pressed, the page is
 *   left, or 5 minutes pass, whichever comes first.
 *
 * Existing `import { toast } from 'sonner'` call sites keep working; new code
 * uses this module.
 */

export const TOAST_DURATION_MS = 4_000
export const UNDO_WINDOW_MS = 5 * 60 * 1_000

export type UndoToastOptions = {
  text: string
  /** Runs when the person presses Undo. onWindowClosed is then never called. */
  onUndo: () => void
  /**
   * Runs exactly once when the window closes without Undo: dismissed, page
   * left, timed out, or replaced by a newer Undo toast. Held side effects
   * (emails, push) are released here (18 NTF-03).
   */
  onWindowClosed?: () => void
  undoLabel?: string
}

export type UndoToastHandle = {
  /** Close the window now without undoing (calls onWindowClosed once). */
  close: () => void
}

type ActionToast = { id: string; close: () => void }

let sequence = 0
let plainId: string | number | null = null
let actionToast: ActionToast | null = null
let queued: (() => void) | null = null

function showPlain(kind: 'success' | 'info', text: string) {
  const run = () => {
    if (plainId !== null) sonner.dismiss(plainId)
    const id = `kanvise-toast-${++sequence}`
    const clear = () => {
      if (plainId === id) plainId = null
    }
    plainId = id
    sonner[kind](text, { id, duration: TOAST_DURATION_MS, onDismiss: clear, onAutoClose: clear })
  }
  if (actionToast) {
    // Only the latest plain toast waits; an older waiting one is replaced.
    queued = run
    return
  }
  run()
}

function flushQueued() {
  const next = queued
  queued = null
  next?.()
}

function undo({ text, onUndo, onWindowClosed, undoLabel = 'Undo' }: UndoToastOptions): UndoToastHandle {
  // A newer Undo closes the older window (its action is kept), so the
  // person can always undo the most recent thing.
  actionToast?.close()
  if (plainId !== null) {
    sonner.dismiss(plainId)
    plainId = null
  }

  const id = `kanvise-undo-${++sequence}`
  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const finish = (undone: boolean) => {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
    if (actionToast?.id === id) actionToast = null
    sonner.dismiss(id)
    if (undone) onUndo()
    else onWindowClosed?.()
    if (!actionToast) flushQueued()
  }
  const onPageHide = () => finish(false)

  timer = setTimeout(() => finish(false), UNDO_WINDOW_MS)
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)
  actionToast = { id, close: () => finish(false) }

  sonner(text, {
    id,
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: { label: undoLabel, onClick: () => finish(true) },
    onDismiss: () => finish(false),
  })

  return { close: () => finish(false) }
}

/** Close any open Undo window, for example when the route changes. */
export function closeActionToasts() {
  actionToast?.close()
}

export const toast = {
  success: (text: string) => showPlain('success', text),
  info: (text: string) => showPlain('info', text),
  undo,
}

/** Test helper: forget all module state. */
export function resetToastStateForTests() {
  sequence = 0
  plainId = null
  actionToast = null
  queued = null
}

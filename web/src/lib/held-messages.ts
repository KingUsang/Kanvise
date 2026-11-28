import { getApiUrl } from '@/config/api'
import { apiRequest } from '@/lib/api-request'
import { toast, type UndoToastHandle } from '@/lib/toast'

/**
 * An action whose message to other people is held until its Undo window
 * closes (18 NTF-03, 01 SH-08). The API returns `heldMessageId` with the
 * action; this shows the Undo toast and tells the API what happened:
 *
 * - Undo: POST /held-messages/:id/undo, then `onUndo` puts the action back.
 *   `onUndo` runs even if that call fails: the message builder reads the
 *   current state when the message is released, so an action that was put
 *   back sends nothing.
 * - The window closes without Undo (dismissed, page left, 5 minutes, or a
 *   newer Undo toast): POST /held-messages/:id/release, best effort. The
 *   server releases the message after 5 minutes anyway.
 */
export type UndoableActionOptions = {
  /** The toast line, for example "Lesson moved to Tue 2 Dec, 10:00 AM." */
  text: string
  heldMessageId: string
  onUndo: () => void | Promise<void>
  /** Called if telling the API about the Undo failed. */
  onUndoError?: (error: unknown) => void
}

function heldMessageUrl(id: string, action: 'undo' | 'release') {
  return `${getApiUrl()}/held-messages/${encodeURIComponent(id)}/${action}`
}

export function cancelHeldMessage(id: string) {
  return apiRequest(heldMessageUrl(id, 'undo'), "We couldn't undo that.", { method: 'POST' })
}

export function releaseHeldMessage(id: string) {
  // keepalive lets the call finish while the page is being left.
  return apiRequest(heldMessageUrl(id, 'release'), "We couldn't send that yet.", { method: 'POST', keepalive: true })
}

export function undoableAction({ text, heldMessageId, onUndo, onUndoError }: UndoableActionOptions): UndoToastHandle {
  return toast.undo({
    text,
    onUndo: () => {
      void cancelHeldMessage(heldMessageId)
        .catch((error) => onUndoError?.(error))
        .finally(() => { void onUndo() })
    },
    onWindowClosed: () => {
      void releaseHeldMessage(heldMessageId).catch(() => {
        // Nothing to do: the server releases held messages after 5 minutes.
      })
    },
  })
}

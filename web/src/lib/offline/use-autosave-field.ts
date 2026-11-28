'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  IDLE_STATUS,
  getSaveQueue,
  recordKind,
  type FieldConflict,
  type FieldState,
  type SaveQueue,
  type SaveSender,
  type SaveVersion,
} from './save-queue'

export type AutosaveField = {
  value: string
  /** Call on every change: the value goes to the device at once and to the server after a short pause. */
  setValue: (value: string) => void
  state: FieldState
  /** When the server last confirmed the change. */
  savedAt: Date | null
  conflict: (FieldConflict & { mine: string; theirs: string }) | null
  retry: () => void
  keepMine: () => void
  useNewer: () => void
}

/**
 * One field that saves by itself (SH-13). The state is honest: 'saved' only
 * after the server confirmed, 'saved-on-device' while there is no connection.
 * A change still waiting on the device from an earlier visit replaces
 * `initialValue` once it has been read.
 */
export function useAutosaveField({
  recordKey,
  field,
  initialValue,
  baseVersion,
  sender,
  queue: providedQueue,
}: {
  recordKey: string
  field: string
  initialValue: string
  baseVersion: SaveVersion
  /** Registers the sender for this record kind while the field is on screen. */
  sender?: SaveSender
  queue?: SaveQueue
}): AutosaveField {
  const queue = providedQueue ?? getSaveQueue()
  const [value, setLocalValue] = useState(initialValue)
  const id = useSyncExternalStore(queue.subscribe, () => queue.fieldId(recordKey, field), () => null)
  const status = useSyncExternalStore(queue.subscribe, () => (id ? queue.getStatus(id) : IDLE_STATUS), () => IDLE_STATUS)

  const senderRef = useRef(sender)
  useEffect(() => {
    senderRef.current = sender
  })
  const hasSender = Boolean(sender)
  useEffect(() => {
    if (!hasSender) return
    return queue.registerSender(recordKind(recordKey), (change) => senderRef.current!(change))
  }, [queue, recordKey, hasSender])

  // Restore a change that is still waiting on this device (IndexedDB).
  useEffect(() => {
    if (!id) return
    let cancelled = false
    void queue.getPending(recordKey, field).then((entry) => {
      if (!cancelled && entry && typeof entry.value === 'string') setLocalValue(entry.value)
    })
    return () => {
      cancelled = true
    }
  }, [queue, id, recordKey, field])

  const setValue = useCallback((next: string) => {
    setLocalValue(next)
    void queue.enqueue({ recordKey, field, value: next, baseVersion }).catch(() => undefined)
  }, [queue, recordKey, field, baseVersion])

  const conflict = status.conflict
    ? { ...status.conflict, mine: String(status.conflict.mine ?? ''), theirs: String(status.conflict.theirs ?? '') }
    : null

  return {
    value,
    setValue,
    state: status.state,
    savedAt: status.savedAt === null ? null : new Date(status.savedAt),
    conflict,
    retry: () => void queue.retry(),
    keepMine: () => {
      if (id) void queue.keepMine(id)
    },
    useNewer: () => {
      if (!id) return
      const theirs = queue.takeNewer(id)
      if (typeof theirs === 'string') setLocalValue(theirs)
    },
  }
}

/** Changes that will upload by themselves (for the "Back online. Uploading n changes…" line). */
export function useUploadingCount(queue: SaveQueue = getSaveQueue()) {
  return useSyncExternalStore(queue.subscribe, queue.uploadingCount, () => 0)
}

import { ApiRequestError } from '@/lib/api-request'

/**
 * Device-first save queue (01-app-shell SH-13, SH-14b; 16-responsive R-08).
 *
 * Every change to a field that saves by itself is written to the device first
 * (IndexedDB, per person and per account, keyed by record and field) and then
 * sent. Only the latest change per field is kept, and changes upload in the
 * order they were made. The queue keeps changes until the server confirms
 * them, or until the person signs out and confirms (SH-06).
 *
 * Record keys are `<kind>:<id>`, for example `lesson-summary:123`. A feature
 * registers one sender per kind with `registerSender` (a module-level call or
 * the `sender` option of useAutosaveField). Changes whose kind has no sender
 * wait on the device. Build step 1 registers none: the first autosaving fields
 * (summary, notes, lesson plan, homework) arrive in later steps.
 *
 * Browser persistence (standard 06): the database is versioned
 * (`kanvise-save-queue`, version 1). Entries are deliberately recoverable
 * drafts, removed after upload or on a confirmed sign-out. Nothing here is
 * server-owned state.
 */

export type SaveVersion = string | number | null

export type SaveChange = {
  recordKey: string
  field: string
  value: unknown
  /** The server version this device last loaded. The server refuses the change when it moved on. */
  baseVersion: SaveVersion
}

/**
 * What a sender returns: 'ok' (or the new version) when the server saved the
 * change, or the server's value when it changed since `baseVersion`. Throwing
 * means the send failed: see classifySaveError.
 */
export type SendResult =
  | 'ok'
  | { ok: true; version: SaveVersion }
  | { conflict: unknown; serverVersion: SaveVersion }

export type SaveSender = (change: SaveChange) => Promise<SendResult>

export type SaveScope = { personId: string; accountId: string }

export type QueueEntry = SaveChange & {
  id: string
  personId: string
  accountId: string
  /** Upload order: the moment the latest change to this field was made. */
  seq: number
}

export interface SaveQueueStorage {
  list(): Promise<QueueEntry[]>
  put(entry: QueueEntry): Promise<void>
  remove(id: string): Promise<void>
}

export type FieldState = 'idle' | 'saving' | 'saved' | 'saved-on-device' | 'couldnt-save'

export type FieldConflict = { mine: unknown; theirs: unknown; serverVersion: SaveVersion }

export type FieldStatus = {
  state: FieldState
  /** When the server last confirmed this field. */
  savedAt: number | null
  conflict: FieldConflict | null
  /** Failed tries with a server error since the last success. */
  failures: number
}

/** Waits between tries while a connection exists but sending fails. */
export const RETRY_DELAYS_MS = [10_000, 30_000, 60_000] as const
/** After the listed waits, try again every 2 minutes while the page is open. */
export const RETRY_EVERY_MS = 120_000
/** The field shows "Couldn't save." after this many failed tries with a server error. */
export const COULDNT_SAVE_AFTER = 3
/** Typing pauses this long before a change is sent; it is already on the device. */
export const SEND_DELAY_MS = 800

/** Throw from a sender when the request never reached the server. */
export class SaveNetworkError extends Error {
  constructor(message = 'The change could not reach the server') {
    super(message)
    this.name = 'SaveNetworkError'
  }
}

/**
 * Network: no connection, keep the change on the device and wait for 'online'.
 * Signed out: keep it and wait for the next sign-in (SH-14b).
 * Server: the server refused or failed; retry on the schedule.
 */
export function classifySaveError(error: unknown, online = isNavigatorOnline()): 'network' | 'signed-out' | 'server' {
  if (error instanceof SaveNetworkError) return 'network'
  // fetch rejects with a TypeError when the request cannot be made.
  if (error instanceof TypeError) return 'network'
  if (!online) return 'network'
  if (error instanceof ApiRequestError && (error.status === 401 || error.code === 'SESSION_EXPIRED')) return 'signed-out'
  return 'server'
}

function isNavigatorOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

const IDLE: FieldStatus = Object.freeze({ state: 'idle', savedAt: null, conflict: null, failures: 0 }) as FieldStatus

export function entryId(scope: SaveScope, recordKey: string, field: string) {
  return [scope.personId, scope.accountId, recordKey, field].map(encodeURIComponent).join('|')
}

export function recordKind(recordKey: string) {
  const index = recordKey.indexOf(':')
  return index === -1 ? recordKey : recordKey.slice(0, index)
}

type QueueEvents = Pick<Window, 'addEventListener' | 'removeEventListener'>

export type SaveQueueOptions = {
  storage: SaveQueueStorage
  isOnline?: () => boolean
  now?: () => number
  sendDelayMs?: number
  /** Window to listen to for 'online' and 'offline'. */
  events?: QueueEvents
}

export type SaveQueue = ReturnType<typeof createSaveQueue>

export function createSaveQueue({
  storage,
  isOnline = isNavigatorOnline,
  now = Date.now,
  sendDelayMs = SEND_DELAY_MS,
  events,
}: SaveQueueOptions) {
  const entries = new Map<string, QueueEntry>()
  const statuses = new Map<string, FieldStatus>()
  const knownVersions = new Map<string, SaveVersion>()
  const senders = new Map<string, SaveSender>()
  const listeners = new Set<() => void>()
  let scope: SaveScope | null = null
  let lastSeq = 0
  let sendTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryIndex = 0
  let flushing: Promise<void> | null = null
  let again = false
  let writes: Promise<void> = Promise.resolve()

  const ready = storage.list().then(
    (stored) => {
      for (const entry of stored) {
        if (entries.has(entry.id)) continue
        entries.set(entry.id, entry)
        lastSeq = Math.max(lastSeq, entry.seq)
      }
    },
    () => undefined,
  )

  // Storage writes run one after another, in the order the changes were made.
  const persist = (write: () => Promise<void>) => {
    writes = writes.then(write).catch(() => undefined)
    return writes
  }

  const emit = () => listeners.forEach((listener) => listener())

  const status = (id: string) => statuses.get(id) ?? IDLE

  const setStatus = (id: string, patch: Partial<FieldStatus>) => {
    statuses.set(id, { ...status(id), ...patch })
  }

  const inScope = (entry: QueueEntry) => scope !== null && entry.personId === scope.personId && entry.accountId === scope.accountId

  const scopedEntries = () => [...entries.values()].filter(inScope).sort((a, b) => a.seq - b.seq)

  const nextSeq = () => {
    lastSeq = Math.max(now(), lastSeq + 1)
    return lastSeq
  }

  const markOnDevice = () => {
    for (const entry of scopedEntries()) {
      const current = status(entry.id)
      if (current.state !== 'couldnt-save') setStatus(entry.id, { state: 'saved-on-device' })
    }
  }

  const clearTimers = () => {
    if (sendTimer) clearTimeout(sendTimer)
    if (retryTimer) clearTimeout(retryTimer)
    sendTimer = null
    retryTimer = null
  }

  const scheduleSend = (delay: number) => {
    // While a retry wait is running, typing does not hurry the next try.
    if (retryTimer || !isOnline()) return
    if (sendTimer) clearTimeout(sendTimer)
    sendTimer = setTimeout(() => {
      sendTimer = null
      void flush()
    }, delay)
  }

  const scheduleRetry = () => {
    const delay = retryIndex < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[retryIndex] : RETRY_EVERY_MS
    retryIndex += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void flush()
    }, delay)
  }

  async function sendOnce() {
    if (sendTimer) clearTimeout(sendTimer)
    sendTimer = null
    if (!scope) return
    if (!isOnline()) {
      markOnDevice()
      emit()
      return
    }
    let serverFailed = false
    const queue = scopedEntries().filter((entry) => !status(entry.id).conflict)
    for (let index = 0; index < queue.length; index += 1) {
      const entry = queue[index]
      const sender = senders.get(recordKind(entry.recordKey))
      if (!sender) continue
      setStatus(entry.id, { state: 'saving' })
      emit()
      let result: SendResult
      try {
        result = await sender({ recordKey: entry.recordKey, field: entry.field, value: entry.value, baseVersion: entry.baseVersion })
      } catch (error) {
        const kind = classifySaveError(error, isOnline())
        if (kind !== 'server') {
          // Lost connection or sign-in: everything waits on the device.
          markOnDevice()
          emit()
          return
        }
        const failures = status(entry.id).failures + 1
        setStatus(entry.id, { failures, state: failures >= COULDNT_SAVE_AFTER ? 'couldnt-save' : 'saving' })
        serverFailed = true
        emit()
        continue
      }
      if (typeof result === 'object' && 'conflict' in result) {
        setStatus(entry.id, {
          state: 'saved-on-device',
          conflict: { mine: entries.get(entry.id)?.value ?? entry.value, theirs: result.conflict, serverVersion: result.serverVersion },
        })
        emit()
        continue
      }
      const version = typeof result === 'object' ? result.version : undefined
      if (version !== undefined) knownVersions.set(entry.id, version)
      const current = entries.get(entry.id)
      if (current && current.seq === entry.seq) {
        entries.delete(entry.id)
        void persist(() => storage.remove(entry.id))
        setStatus(entry.id, { state: 'saved', savedAt: now(), failures: 0 })
      } else if (current) {
        // A newer change arrived while this one was sending: send it next,
        // against the version this upload created.
        if (version !== undefined) {
          const rebased = { ...current, baseVersion: version }
          entries.set(entry.id, rebased)
          void persist(() => storage.put(rebased))
        }
        setStatus(entry.id, { failures: 0 })
        again = true
      }
      emit()
    }
    if (serverFailed) scheduleRetry()
    else retryIndex = 0
  }

  async function flush() {
    await ready
    if (flushing) {
      again = true
      return flushing
    }
    flushing = (async () => {
      do {
        again = false
        await sendOnce()
      } while (again && isOnline())
    })().finally(() => {
      flushing = null
    })
    return flushing
  }

  const handleOnline = () => {
    clearTimers()
    retryIndex = 0
    void flush()
  }

  const handleOffline = () => {
    clearTimers()
    markOnDevice()
    emit()
  }

  events?.addEventListener('online', handleOnline)
  events?.addEventListener('offline', handleOffline)

  return {
    ready,

    /** The person and account changes belong to. Changes from other accounts wait until that account is selected. */
    setScope(next: SaveScope | null) {
      const changed = next?.personId !== scope?.personId || next?.accountId !== scope?.accountId
      scope = next
      if (!changed) return
      emit()
      void ready.then(() => {
        if (!scope) return
        const waiting = scopedEntries()
        if (waiting.length === 0) return
        if (isOnline()) {
          for (const entry of waiting) {
            if (status(entry.id).state === 'idle' && senders.has(recordKind(entry.recordKey))) setStatus(entry.id, { state: 'saving' })
          }
          scheduleSend(0)
        } else markOnDevice()
        emit()
      })
    },

    getScope: () => scope,

    fieldId(recordKey: string, field: string) {
      return scope ? entryId(scope, recordKey, field) : null
    },

    registerSender(kind: string, sender: SaveSender) {
      senders.set(kind, sender)
      void ready.then(() => {
        if (scopedEntries().some((entry) => recordKind(entry.recordKey) === kind)) scheduleSend(0)
      })
      return () => {
        if (senders.get(kind) === sender) senders.delete(kind)
      }
    },

    /** Writes the change to the device, then sends it after a short pause. */
    async enqueue(change: SaveChange) {
      await ready
      if (!scope) throw new Error('The save queue has no person and account yet')
      const id = entryId(scope, change.recordKey, change.field)
      const baseVersion = knownVersions.has(id) ? (knownVersions.get(id) as SaveVersion) : change.baseVersion
      const entry: QueueEntry = { ...change, baseVersion, id, personId: scope.personId, accountId: scope.accountId, seq: nextSeq() }
      entries.set(id, entry)
      await persist(() => storage.put(entry))
      const current = status(id)
      if (current.conflict) {
        setStatus(id, { conflict: { ...current.conflict, mine: change.value } })
      } else if (!isOnline()) {
        setStatus(id, { state: 'saved-on-device' })
      } else if (current.state !== 'couldnt-save') {
        setStatus(id, { state: 'saving' })
      }
      emit()
      if (!current.conflict) scheduleSend(sendDelayMs)
    },

    flush,

    /** "Retry" after "Couldn't save.": try now instead of waiting. */
    retry() {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
      return flush()
    },

    /** "Keep mine": send this device's value over the newer version. */
    keepMine(id: string) {
      const current = status(id)
      const entry = entries.get(id)
      if (!current.conflict || !entry) return Promise.resolve()
      knownVersions.set(id, current.conflict.serverVersion)
      const rebased = { ...entry, baseVersion: current.conflict.serverVersion }
      entries.set(id, rebased)
      setStatus(id, { conflict: null, state: isOnline() ? 'saving' : 'saved-on-device' })
      emit()
      return persist(() => storage.put(rebased)).then(() => flush())
    },

    /** "Use the newer version": drop this device's change and return the server's value. */
    takeNewer(id: string): unknown {
      const current = status(id)
      if (!current.conflict) return undefined
      knownVersions.set(id, current.conflict.serverVersion)
      entries.delete(id)
      void persist(() => storage.remove(id))
      setStatus(id, { conflict: null, state: 'idle', failures: 0 })
      emit()
      return current.conflict.theirs
    },

    getStatus: status,

    /** The change waiting on the device for this field, if any (to restore a draft after a reload). */
    async getPending(recordKey: string, field: string) {
      await ready
      if (!scope) return null
      return entries.get(entryId(scope, recordKey, field)) ?? null
    },

    /** Changes waiting on the device for this person, in every account. */
    async pendingCount(personId = scope?.personId) {
      await ready
      if (!personId) return 0
      return [...entries.values()].filter((entry) => entry.personId === personId).length
    },

    /** Changes that will upload by themselves now: not in conflict, not stuck on "Couldn't save.", with a sender. */
    uploadingCount() {
      return scopedEntries().filter((entry) => {
        const current = status(entry.id)
        return !current.conflict && current.state !== 'couldnt-save' && senders.has(recordKind(entry.recordKey))
      }).length
    },

    /** Only after a confirmed sign-out (SH-06). */
    async clearForPerson(personId: string) {
      await ready
      const ids = [...entries.values()].filter((entry) => entry.personId === personId).map((entry) => entry.id)
      for (const id of ids) {
        entries.delete(id)
        statuses.delete(id)
        knownVersions.delete(id)
      }
      await persist(async () => {
        for (const id of ids) await storage.remove(id)
      })
      emit()
    },

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    handleOnline,
    handleOffline,

    dispose() {
      clearTimers()
      events?.removeEventListener('online', handleOnline)
      events?.removeEventListener('offline', handleOffline)
      listeners.clear()
    },
  }
}

export const IDLE_STATUS = IDLE

/** In-memory storage: tests, and browsers without IndexedDB (nothing survives a reload). */
export function createMemoryStorage(initial: QueueEntry[] = []): SaveQueueStorage {
  const rows = new Map(initial.map((entry) => [entry.id, entry]))
  return {
    list: async () => [...rows.values()],
    put: async (entry) => {
      rows.set(entry.id, entry)
    },
    remove: async (id) => {
      rows.delete(id)
    },
  }
}

const DB_NAME = 'kanvise-save-queue'
const DB_VERSION = 1
const STORE = 'changes'

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** IndexedDB storage: survives closing the tab and restarting the phone. */
export function createIndexedDbStorage(factory: IDBFactory = indexedDB): SaveQueueStorage {
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    const database = await db
    const transaction = database.transaction(STORE, mode)
    const result = await request(action(transaction.objectStore(STORE)))
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    return result
  }
  return {
    list: () => run('readonly', (store) => store.getAll() as IDBRequest<QueueEntry[]>),
    put: async (entry) => {
      await run('readwrite', (store) => store.put(entry))
    },
    remove: async (id) => {
      await run('readwrite', (store) => store.delete(id))
    },
  }
}

let browserQueue: SaveQueue | null = null

/** The page's save queue. IndexedDB when the browser has it, memory otherwise. */
export function getSaveQueue(): SaveQueue {
  if (browserQueue) return browserQueue
  if (typeof window === 'undefined') return createSaveQueue({ storage: createMemoryStorage() })
  let storage: SaveQueueStorage
  try {
    storage = typeof indexedDB === 'undefined' ? createMemoryStorage() : createIndexedDbStorage()
  } catch {
    storage = createMemoryStorage()
  }
  browserQueue = createSaveQueue({ storage: withMemoryFallback(storage), events: window })
  return browserQueue
}

/** Private browsing can refuse IndexedDB; keep working in memory for this page. */
function withMemoryFallback(primary: SaveQueueStorage): SaveQueueStorage {
  const memory = createMemoryStorage()
  let failed = false
  const attempt = async <T>(action: (storage: SaveQueueStorage) => Promise<T>) => {
    if (!failed) {
      try {
        return await action(primary)
      } catch {
        failed = true
      }
    }
    return action(memory)
  }
  return {
    list: () => attempt((storage) => storage.list()),
    put: (entry) => attempt((storage) => storage.put(entry)),
    remove: (id) => attempt((storage) => storage.remove(id)),
  }
}

export type QueuedAnswer = {
  selected_option_version_id: string | null
  theory_answer_text: string | null
  is_flagged: boolean
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

// Answers queued on the device are bound to the signed-in learner and expire, so a
// shared computer does not keep one learner's work for the next (DEV-QUIZ-032).
export const QUEUED_ANSWER_TTL_MS = 24 * 60 * 60 * 1000
const PREFIX = 'kanvise-attempt:v2:'
const LEGACY_PREFIX = 'kanvise-attempt-'

export function queuedAnswerKey(userId: string, attemptId: string, questionId: string) {
  return `${PREFIX}${userId}:${attemptId}:${questionId}`
}

export function writeQueuedAnswer(storage: StorageLike, key: string, answer: QueuedAnswer, now = Date.now()) {
  try {
    storage.setItem(key, JSON.stringify({ answer, expires_at: now + QUEUED_ANSWER_TTL_MS }))
  } catch {
    // Storage can be full or blocked. The in-memory queue still retries the save.
  }
}

export function readQueuedAnswer(storage: StorageLike, key: string, now = Date.now()): QueuedAnswer | null {
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { answer?: QueuedAnswer; expires_at?: number }
    if (!parsed?.answer || typeof parsed.expires_at !== 'number' || parsed.expires_at <= now) {
      storage.removeItem(key)
      return null
    }
    return parsed.answer
  } catch {
    storage.removeItem(key)
    return null
  }
}

function storageKeys(storage: StorageLike) {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key) keys.push(key)
  }
  return keys
}

/** Removes every queued answer for one attempt, after it is submitted or finalized. */
export function clearAttemptAnswers(storage: StorageLike, userId: string, attemptId: string) {
  const prefix = `${PREFIX}${userId}:${attemptId}:`
  for (const key of storageKeys(storage)) if (key.startsWith(prefix)) storage.removeItem(key)
}

/**
 * Drops legacy unbound entries, expired entries and entries that belong to another
 * learner. Run when an attempt opens.
 */
export function purgeStaleQueuedAnswers(storage: StorageLike, userId: string, now = Date.now()) {
  for (const key of storageKeys(storage)) {
    if (key.startsWith(PREFIX)) {
      if (!key.startsWith(`${PREFIX}${userId}:`)) storage.removeItem(key)
      else readQueuedAnswer(storage, key, now)
    } else if (key.startsWith(LEGACY_PREFIX)) {
      storage.removeItem(key)
    }
  }
}

/**
 * Serializes saves and lets the newest value for a key win (DEV-QUIZ-031). Each
 * task reads the latest value when it runs, so a stale intermediate value is never
 * sent after a newer one, and requests never race each other on the server.
 */
export function createLatestWinsQueue<T>(send: (key: string, value: T, isCurrent: () => boolean) => Promise<boolean>) {
  let chain: Promise<unknown> = Promise.resolve()
  const latest = new Map<string, { value: T; revision: number }>()
  const saved = new Map<string, number>()
  let revision = 0

  return {
    enqueue(key: string, value: T): Promise<boolean> {
      revision += 1
      latest.set(key, { value, revision })
      const task = chain.then(async () => {
        const current = latest.get(key)!
        if ((saved.get(key) ?? 0) >= current.revision) return true
        let ok = false
        try {
          ok = await send(key, current.value, () => latest.get(key)?.revision === current.revision)
        } catch {
          ok = false
        }
        if (ok) saved.set(key, current.revision)
        return ok
      })
      chain = task.catch(() => undefined)
      return task
    },
  }
}

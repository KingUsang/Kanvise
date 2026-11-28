import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/lib/api-request'
import {
  COULDNT_SAVE_AFTER,
  SEND_DELAY_MS,
  SaveNetworkError,
  classifySaveError,
  createMemoryStorage,
  createSaveQueue,
  entryId,
  type SaveChange,
  type SaveQueueStorage,
  type SendResult,
} from './save-queue'

const scope = { personId: 'p-1', accountId: 'a-1' }

function setup({ online = true, storage = createMemoryStorage() }: { online?: boolean; storage?: SaveQueueStorage } = {}) {
  const connection = { online }
  const queue = createSaveQueue({ storage, isOnline: () => connection.online })
  queue.setScope(scope)
  return { queue, connection, storage }
}

const id = (recordKey: string, field: string) => entryId(scope, recordKey, field)

/** Let queued promises (storage writes, sends) settle under fake timers. */
async function settle() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve()
}

async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await settle()
}

describe('save queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-28T16:12:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps only the latest change per field', async () => {
    const { queue } = setup()
    const sent: SaveChange[] = []
    queue.registerSender('summary', async (change) => {
      sent.push(change)
      return 'ok'
    })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'H', baseVersion: 1 })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'He', baseVersion: 1 })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hello', baseVersion: 1 })
    expect(await queue.pendingCount()).toBe(1)
    await advance(SEND_DELAY_MS)
    expect(sent).toEqual([{ recordKey: 'summary:1', field: 'text', value: 'Hello', baseVersion: 1 }])
    expect(await queue.pendingCount()).toBe(0)
  })

  it('uploads changes in the order they were made, across fields', async () => {
    const { queue } = setup()
    const order: string[] = []
    queue.registerSender('lesson', async (change) => {
      order.push(`${change.field}=${change.value}`)
      return 'ok'
    })
    await queue.enqueue({ recordKey: 'lesson:1', field: 'notes', value: 'a', baseVersion: null })
    vi.advanceTimersByTime(5)
    await queue.enqueue({ recordKey: 'lesson:1', field: 'plan', value: 'b', baseVersion: null })
    vi.advanceTimersByTime(5)
    // The latest change to notes was made after plan, so it goes after plan.
    await queue.enqueue({ recordKey: 'lesson:1', field: 'notes', value: 'c', baseVersion: null })
    await advance(SEND_DELAY_MS)
    expect(order).toEqual(['plan=b', 'notes=c'])
  })

  it('writes to the device first and survives a new queue on the same storage (tab closed)', async () => {
    const storage = createMemoryStorage()
    const first = setup({ online: false, storage }).queue
    await first.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Draft', baseVersion: 3 })
    expect(first.getStatus(id('summary:1', 'text')).state).toBe('saved-on-device')
    first.dispose()

    const { queue } = setup({ storage })
    await queue.ready
    expect(await queue.pendingCount()).toBe(1)
    expect((await queue.getPending('summary:1', 'text'))?.value).toBe('Draft')
  })

  it('marks "Saved" only after the server confirms', async () => {
    const { queue } = setup()
    let confirm: (result: SendResult) => void = () => undefined
    queue.registerSender('summary', () => new Promise((resolve) => { confirm = resolve }))
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi', baseVersion: 1 })
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saving')
    await advance(SEND_DELAY_MS)
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saving')
    confirm({ ok: true, version: 2 })
    await settle()
    const status = queue.getStatus(id('summary:1', 'text'))
    expect(status.state).toBe('saved')
    expect(status.savedAt).toBe(new Date('2026-11-28T16:12:00.800').getTime())
  })

  it('keeps network failures on the device and never shows "Saved"', async () => {
    const { queue, connection } = setup()
    const sender = vi.fn(async (): Promise<SendResult> => { throw new SaveNetworkError() })
    queue.registerSender('summary', sender)
    const states: string[] = []
    queue.subscribe(() => states.push(queue.getStatus(id('summary:1', 'text')).state))
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi', baseVersion: 1 })
    await advance(SEND_DELAY_MS)
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saved-on-device')
    // No retry timer for a lost connection: it waits for 'online'.
    await advance(10 * 60_000)
    expect(sender).toHaveBeenCalledTimes(1)
    expect(states).not.toContain('saved')

    connection.online = false
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi there', baseVersion: 1 })
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saved-on-device')
    expect(await queue.pendingCount()).toBe(1)
  })

  it('uploads straight away when the connection comes back', async () => {
    const { queue, connection } = setup({ online: false })
    const sender = vi.fn(async (): Promise<SendResult> => 'ok')
    queue.registerSender('summary', sender)
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Offline text', baseVersion: 1 })
    await advance(60_000)
    expect(sender).not.toHaveBeenCalled()
    expect(queue.uploadingCount()).toBe(1)
    connection.online = true
    queue.handleOnline()
    await settle()
    expect(sender).toHaveBeenCalledTimes(1)
    expect(queue.uploadingCount()).toBe(0)
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saved')
  })

  it('retries server errors after 10 s, 30 s, 60 s, then every 2 minutes, and shows "Couldn\'t save" after the third try', async () => {
    const { queue } = setup()
    const sender = vi.fn(async (): Promise<SendResult> => { throw new ApiRequestError(500, 'Server error') })
    queue.registerSender('summary', sender)
    const field = id('summary:1', 'text')
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi', baseVersion: 1 })
    await advance(SEND_DELAY_MS)
    expect(sender).toHaveBeenCalledTimes(1)
    expect(queue.getStatus(field).state).toBe('saving')

    await advance(9_999)
    expect(sender).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(sender).toHaveBeenCalledTimes(2)
    expect(queue.getStatus(field).state).toBe('saving')

    await advance(29_999)
    expect(sender).toHaveBeenCalledTimes(2)
    await advance(1)
    expect(sender).toHaveBeenCalledTimes(COULDNT_SAVE_AFTER)
    expect(queue.getStatus(field).state).toBe('couldnt-save')
    expect(await queue.pendingCount()).toBe(1)
    expect((await queue.getPending('summary:1', 'text'))?.value).toBe('Hi')

    await advance(60_000)
    expect(sender).toHaveBeenCalledTimes(4)
    await advance(119_999)
    expect(sender).toHaveBeenCalledTimes(4)
    await advance(1)
    expect(sender).toHaveBeenCalledTimes(5)
    await advance(120_000)
    expect(sender).toHaveBeenCalledTimes(6)
    expect(queue.uploadingCount()).toBe(0)
  })

  it('Retry tries again at once and clears "Couldn\'t save" when it works', async () => {
    const { queue } = setup()
    let fail = true
    const sender = vi.fn(async (): Promise<SendResult> => {
      if (fail) throw new ApiRequestError(503, 'Unavailable')
      return 'ok'
    })
    queue.registerSender('summary', sender)
    const field = id('summary:1', 'text')
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi', baseVersion: 1 })
    await advance(SEND_DELAY_MS + 10_000 + 30_000)
    expect(queue.getStatus(field).state).toBe('couldnt-save')
    fail = false
    await queue.retry()
    expect(sender).toHaveBeenCalledTimes(4)
    expect(queue.getStatus(field).state).toBe('saved')
    expect(await queue.pendingCount()).toBe(0)
  })

  it('surfaces both versions on a conflict, and Keep mine re-sends with the newer base version', async () => {
    const { queue } = setup()
    const sent: SaveChange[] = []
    queue.registerSender('plan', async (change) => {
      sent.push(change)
      if (change.baseVersion === 4) return { conflict: 'Their plan', serverVersion: 7 }
      return { ok: true, version: 8 }
    })
    const field = id('plan:1', 'text')
    await queue.enqueue({ recordKey: 'plan:1', field: 'text', value: 'My plan', baseVersion: 4 })
    await advance(SEND_DELAY_MS)
    expect(queue.getStatus(field).conflict).toEqual({ mine: 'My plan', theirs: 'Their plan', serverVersion: 7 })
    expect(queue.getStatus(field).state).toBe('saved-on-device')
    // Nothing is sent again until the person chooses.
    await advance(10 * 60_000)
    expect(sent).toHaveLength(1)

    await queue.keepMine(field)
    expect(sent).toHaveLength(2)
    expect(sent[1]).toEqual({ recordKey: 'plan:1', field: 'text', value: 'My plan', baseVersion: 7 })
    expect(queue.getStatus(field).state).toBe('saved')
    expect(queue.getStatus(field).conflict).toBeNull()

    // The next change goes against the version the last upload created.
    await queue.enqueue({ recordKey: 'plan:1', field: 'text', value: 'My plan v2', baseVersion: 4 })
    await advance(SEND_DELAY_MS)
    expect(sent[2].baseVersion).toBe(8)
  })

  it('Use the newer version drops the device change and returns the server value', async () => {
    const { queue } = setup()
    queue.registerSender('plan', async () => ({ conflict: 'Their plan', serverVersion: 7 }))
    const field = id('plan:1', 'text')
    await queue.enqueue({ recordKey: 'plan:1', field: 'text', value: 'My plan', baseVersion: 4 })
    await advance(SEND_DELAY_MS)
    expect(queue.takeNewer(field)).toBe('Their plan')
    expect(await queue.pendingCount()).toBe(0)
    expect(queue.getStatus(field)).toMatchObject({ state: 'idle', conflict: null })
  })

  it('does not drop a newer change that arrives while the older one is sending', async () => {
    const { queue } = setup()
    const sent: SaveChange[] = []
    let release: () => void = () => undefined
    queue.registerSender('summary', async (change) => {
      sent.push(change)
      if (sent.length === 1) await new Promise<void>((resolve) => { release = resolve })
      return { ok: true, version: sent.length + 1 }
    })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'One', baseVersion: 1 })
    await advance(SEND_DELAY_MS)
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'One two', baseVersion: 1 })
    release()
    await settle()
    await advance(SEND_DELAY_MS)
    expect(sent.map((change) => [change.value, change.baseVersion])).toEqual([['One', 1], ['One two', 2]])
    expect(await queue.pendingCount()).toBe(0)
  })

  it('counts and clears changes per person, across their accounts', async () => {
    const storage = createMemoryStorage()
    const { queue } = setup({ online: false, storage })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'A', baseVersion: null })
    queue.setScope({ personId: 'p-1', accountId: 'a-2' })
    await queue.enqueue({ recordKey: 'summary:9', field: 'text', value: 'B', baseVersion: null })
    queue.setScope({ personId: 'p-2', accountId: 'a-1' })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'C', baseVersion: null })

    expect(await queue.pendingCount('p-1')).toBe(2)
    expect(await queue.pendingCount('p-2')).toBe(1)
    await queue.clearForPerson('p-1')
    expect(await queue.pendingCount('p-1')).toBe(0)
    expect(await queue.pendingCount('p-2')).toBe(1)
    expect((await storage.list()).map((entry) => entry.value)).toEqual(['C'])
  })

  it('only uploads changes for the selected account', async () => {
    const { queue } = setup()
    const sent: string[] = []
    queue.registerSender('summary', async (change) => {
      sent.push(String(change.value))
      return 'ok'
    })
    queue.setScope({ personId: 'p-1', accountId: 'a-2' })
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Other account', baseVersion: null })
    queue.setScope(scope)
    await advance(SEND_DELAY_MS)
    expect(sent).toEqual([])
    expect(await queue.pendingCount()).toBe(1)
  })

  it('waits for the next sign-in when the session has ended (SH-14b)', async () => {
    const { queue } = setup()
    let signedIn = false
    const sender = vi.fn(async (): Promise<SendResult> => {
      if (!signedIn) throw new ApiRequestError(401, 'Signed out', { code: 'SESSION_EXPIRED' })
      return 'ok'
    })
    queue.registerSender('summary', sender)
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi', baseVersion: 1 })
    await advance(SEND_DELAY_MS)
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saved-on-device')
    await advance(10 * 60_000)
    expect(sender).toHaveBeenCalledTimes(1)
    signedIn = true
    await queue.flush()
    expect(queue.getStatus(id('summary:1', 'text')).state).toBe('saved')
  })

  it('keeps changes without a sender on the device', async () => {
    const { queue } = setup()
    await queue.enqueue({ recordKey: 'summary:1', field: 'text', value: 'Hi', baseVersion: 1 })
    await advance(SEND_DELAY_MS)
    expect(await queue.pendingCount()).toBe(1)
    expect(queue.uploadingCount()).toBe(0)
  })
})

describe('classifySaveError', () => {
  it('tells lost connections, ended sign-ins and server failures apart', () => {
    expect(classifySaveError(new SaveNetworkError(), true)).toBe('network')
    expect(classifySaveError(new TypeError('Failed to fetch'), true)).toBe('network')
    expect(classifySaveError(new ApiRequestError(500, 'x'), false)).toBe('network')
    expect(classifySaveError(new ApiRequestError(401, 'x'), true)).toBe('signed-out')
    expect(classifySaveError(new ApiRequestError(500, 'x'), true)).toBe('server')
    expect(classifySaveError(new ApiRequestError(409, 'x'), true)).toBe('server')
  })
})

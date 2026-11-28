import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: { id: 'tutor-1' } as any,
  account: { id: 'school-1', membershipId: 'm-1', role: 'tutor' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', mocks.account); await next() },
}))

import { mapApiError } from '../lib/api-contract'
import { configureHeldMessageRoutes, heldMessagesRouter } from '../routes/held-messages'
import {
  HELD_MESSAGE_WINDOW_MS,
  RELEASE_HELD_MESSAGES_JOB,
  holdMessage,
  releaseDueHeldMessages,
  releaseHeldMessageNow,
  undoHeldMessage,
  type HeldMessageDependencies,
  type HeldMessageRepository,
  type HeldMessageRow,
} from './held-messages'
import type { NotificationRequest, NotificationResult } from './types'

/**
 * An in-memory stand-in for held_messages that follows the same rules as
 * claim_due_held_messages: per subject only the newest held row can go, and
 * releasing it supersedes the older ones.
 */
function memoryRepository(clock: { now: Date }) {
  let next = 0
  const rows: Array<HeldMessageRow & { created: number }> = []
  const repository: HeldMessageRepository & { rows: typeof rows } = {
    rows,
    async insert(input) {
      next += 1
      const row = {
        id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
        school_id: input.schoolId, actor_id: input.actorId, subject_key: input.subjectKey, event: input.event,
        params: input.params, status: 'held', release_at: input.releaseAt.toISOString(), attempts: 0, created: next,
      }
      rows.push(row)
      return { id: row.id, releaseAt: row.release_at }
    },
    async cancel(id, actorId, schoolId) {
      const row = rows.find((item) => item.id === id && item.actor_id === actorId && item.school_id === schoolId && item.status === 'held')
      if (!row) return false
      row.status = 'cancelled'
      return true
    },
    async releaseNow(id, actorId, schoolId) {
      const row = rows.find((item) => item.id === id && item.actor_id === actorId && item.school_id === schoolId && item.status === 'held')
      if (!row) return false
      if (new Date(row.release_at) > clock.now) row.release_at = clock.now.toISOString()
      return true
    },
    async claimDue() {
      const newest = new Map<string, (typeof rows)[number]>()
      for (const row of rows.filter((item) => item.status === 'held')) {
        const key = `${row.school_id}|${row.subject_key}`
        if (!newest.has(key) || newest.get(key)!.created < row.created) newest.set(key, row)
      }
      const claimed: HeldMessageRow[] = []
      for (const row of newest.values()) {
        if (new Date(row.release_at) > clock.now) continue
        for (const older of rows) {
          if (older !== row && older.status === 'held' && older.school_id === row.school_id && older.subject_key === row.subject_key) older.status = 'superseded'
        }
        row.status = 'released'
        row.attempts += 1
        claimed.push({ ...row })
      }
      for (const row of rows.filter((item) => item.status === 'failed' && item.attempts < 5)) {
        row.status = 'released'
        row.attempts += 1
        claimed.push({ ...row })
      }
      return claimed
    },
    async finish(id, status) {
      const row = rows.find((item) => item.id === id)!
      if (row.status === 'released') row.status = status
    },
  }
  return repository
}

const okResult = (event: string): NotificationResult => ({
  event: event as never, recipients: 1, inAppCreated: 1, emailsSent: 1, emailsAlreadySent: 0, skippedNoEmail: 0,
  pushSent: 1, pushAlreadySent: 0, pushSkipped: 0, switchedOff: 0, failures: [],
})

function setup() {
  const clock = { now: new Date('2026-12-01T10:00:00Z') }
  const repository = memoryRepository(clock)
  const enqueue = vi.fn(async () => 'job-1')
  const delivered: string[] = []
  const deliver = vi.fn(async (request: NotificationRequest<any>) => {
    delivered.push(request.title)
    return okResult(request.event)
  })
  // Test doubles for builders that later steps will register.
  const builders: HeldMessageDependencies['builders'] = {
    test_moved: async (row) => ({
      schoolId: row.school_id, event: 'class_cancelled', recipients: { recipientIds: ['student-1'] }, title: 'Lesson moved',
      body: 'moved', relatedEntityType: 'live_class', relatedEntityId: String(row.params.lessonId), push: { body: 'moved', url: '/x' },
      emailInput: () => ({} as never),
    }),
    test_cancelled: async (row) => ({
      schoolId: row.school_id, event: 'class_cancelled', recipients: { recipientIds: ['student-1'] }, title: 'Lesson cancelled',
      body: 'cancelled', relatedEntityType: 'live_class', relatedEntityId: String(row.params.lessonId), push: { body: 'cancelled', url: '/x' },
      emailInput: () => ({} as never),
    }),
    test_gone: async () => null,
  }
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  const deps: Partial<HeldMessageDependencies> = { repository, enqueue, deliver, builders, logger, now: () => clock.now }
  const advance = (ms: number) => { clock.now = new Date(clock.now.getTime() + ms) }
  const hold = (event: string, extra: Partial<{ actorId: string; subjectKey: string }> = {}) => holdMessage({
    schoolId: 'school-1', actorId: extra.actorId ?? 'tutor-1', subjectKey: extra.subjectKey ?? 'lesson:1', event, params: { lessonId: 'lesson-1' },
  }, deps)
  return { clock, repository, enqueue, deliver, delivered, deps, advance, hold, logger }
}

describe('held messages (NTF-03)', () => {
  it('holds for 5 minutes and wakes the releaser when the window closes', async () => {
    const { hold, enqueue } = setup()
    const held = await hold('test_moved')
    expect(held.releaseAt).toBe('2026-12-01T10:05:00.000Z')
    expect(HELD_MESSAGE_WINDOW_MS).toBe(300_000)
    expect(enqueue).toHaveBeenCalledWith({
      jobType: RELEASE_HELD_MESSAGES_JOB,
      dedupeKey: `${RELEASE_HELD_MESSAGES_JOB}:${held.id}:window`,
      payload: { heldMessageId: held.id, schoolId: 'school-1' },
      runAt: new Date('2026-12-01T10:05:00.000Z'),
    })
  })

  it('sends nothing before the window closes and sends after it', async () => {
    const { hold, advance, deps, delivered, repository } = setup()
    const held = await hold('test_moved')
    advance(4 * 60_000)
    await releaseDueHeldMessages(deps)
    expect(delivered).toEqual([])
    advance(60_000)
    await expect(releaseDueHeldMessages(deps)).resolves.toMatchObject({ sent: 1 })
    expect(delivered).toEqual(['Lesson moved'])
    expect(repository.rows.find((row) => row.id === held.id)?.status).toBe('sent')
  })

  it('Undo by the person who acted sends nothing', async () => {
    const { hold, advance, deps, delivered } = setup()
    const held = await hold('test_moved')
    await expect(undoHeldMessage({ id: held.id, actorId: 'tutor-1', schoolId: 'school-1' }, deps)).resolves.toBe(true)
    advance(HELD_MESSAGE_WINDOW_MS)
    await releaseDueHeldMessages(deps)
    expect(delivered).toEqual([])
  })

  it('Undo by anyone else, or from another account, changes nothing', async () => {
    const { hold, deps } = setup()
    const held = await hold('test_moved')
    await expect(undoHeldMessage({ id: held.id, actorId: 'tutor-2', schoolId: 'school-1' }, deps)).resolves.toBe(false)
    await expect(undoHeldMessage({ id: held.id, actorId: 'tutor-1', schoolId: 'school-2' }, deps)).resolves.toBe(false)
  })

  it('last state wins: a move then a cancel sends only the cancel', async () => {
    const { hold, advance, deps, delivered } = setup()
    await hold('test_moved')
    advance(60_000)
    await hold('test_cancelled')
    advance(HELD_MESSAGE_WINDOW_MS)
    await releaseDueHeldMessages(deps)
    await releaseDueHeldMessages(deps)
    expect(delivered).toEqual(['Lesson cancelled'])
  })

  it('an undone newer message lets the older one send, at once if its window has closed', async () => {
    const { hold, advance, deps, delivered, enqueue } = setup()
    await hold('test_moved')
    advance(4 * 60_000)
    const cancel = await hold('test_cancelled')
    advance(2 * 60_000) // the move's window has closed, the cancel's has not
    await releaseDueHeldMessages(deps)
    expect(delivered).toEqual([])
    await undoHeldMessage({ id: cancel.id, actorId: 'tutor-1', schoolId: 'school-1' }, deps)
    expect(enqueue).toHaveBeenLastCalledWith(expect.objectContaining({ dedupeKey: `${RELEASE_HELD_MESSAGES_JOB}:${cancel.id}:undone`, runAt: deps.now!() }))
    await releaseDueHeldMessages(deps)
    expect(delivered).toEqual(['Lesson moved'])
  })

  it('subjects are independent', async () => {
    const { hold, advance, deps, delivered } = setup()
    await hold('test_moved', { subjectKey: 'lesson:1' })
    await hold('test_cancelled', { subjectKey: 'lesson:2' })
    advance(HELD_MESSAGE_WINDOW_MS)
    await releaseDueHeldMessages(deps)
    expect(delivered.sort()).toEqual(['Lesson cancelled', 'Lesson moved'])
  })

  it('release now (the toast closed) sends on the next run', async () => {
    const { hold, deps, delivered, enqueue } = setup()
    const held = await hold('test_moved')
    await expect(releaseHeldMessageNow({ id: held.id, actorId: 'tutor-1', schoolId: 'school-1' }, deps)).resolves.toBe(true)
    expect(enqueue).toHaveBeenLastCalledWith(expect.objectContaining({ dedupeKey: `${RELEASE_HELD_MESSAGES_JOB}:${held.id}:now`, runAt: deps.now!() }))
    await releaseDueHeldMessages(deps)
    expect(delivered).toEqual(['Lesson moved'])
    await expect(releaseHeldMessageNow({ id: held.id, actorId: 'tutor-1', schoolId: 'school-1' }, deps)).resolves.toBe(false)
  })

  it('a builder that returns null drops the message', async () => {
    const { hold, advance, deps, delivered, repository } = setup()
    const held = await hold('test_gone')
    advance(HELD_MESSAGE_WINDOW_MS)
    await expect(releaseDueHeldMessages(deps)).resolves.toMatchObject({ dropped: 1 })
    expect(delivered).toEqual([])
    expect(repository.rows.find((row) => row.id === held.id)?.status).toBe('dropped')
  })

  it('a delivery failure is recorded and rethrown so the durable job retries', async () => {
    const { hold, advance, deps, repository } = setup()
    const held = await hold('test_moved')
    advance(HELD_MESSAGE_WINDOW_MS)
    const failing = vi.fn(async (request: NotificationRequest<any>) => ({
      ...okResult(request.event), failures: [{ recipientId: 'student-1', channel: 'email' as const, error: 'provider down' }],
    }))
    await expect(releaseDueHeldMessages({ ...deps, deliver: failing })).rejects.toThrow('1 held message(s) failed to send')
    expect(repository.rows.find((row) => row.id === held.id)?.status).toBe('failed')
    await expect(releaseDueHeldMessages(deps)).resolves.toMatchObject({ sent: 1 })
  })

  it('an event with no builder fails instead of vanishing', async () => {
    const { hold, advance, deps } = setup()
    await hold('nobody_builds_this')
    advance(HELD_MESSAGE_WINDOW_MS)
    await expect(releaseDueHeldMessages(deps)).rejects.toThrow('failed to send')
  })
})

describe('held message routes', () => {
  const app = new Hono()
  app.onError(mapApiError)
  app.route('/held-messages', heldMessagesRouter)
  let env: ReturnType<typeof setup>

  beforeEach(() => {
    env = setup()
    configureHeldMessageRoutes(env.deps)
    mocks.user = { id: 'tutor-1' }
    mocks.account = { id: 'school-1', membershipId: 'm-1', role: 'tutor' }
  })

  it('undoes the caller own message', async () => {
    const held = await env.hold('test_moved')
    const response = await app.request(`/held-messages/${held.id}/undo`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { id: held.id, status: 'cancelled' } })
  })

  it('answers 404 for another person, another account, or a missing message, all the same', async () => {
    const held = await env.hold('test_moved')
    mocks.user = { id: 'tutor-2' }
    const other = await app.request(`/held-messages/${held.id}/undo`, { method: 'POST' })
    mocks.user = { id: 'tutor-1' }
    mocks.account = { id: 'school-2', membershipId: 'm-2', role: 'tutor' }
    const foreign = await app.request(`/held-messages/${held.id}/release`, { method: 'POST' })
    const missing = await app.request('/held-messages/00000000-0000-4000-8000-999999999999/undo', { method: 'POST' })
    const bodies = await Promise.all([other, foreign, missing].map(async (response) => {
      const body = await response.json() as any
      return { status: response.status, code: body.code, error: body.error }
    }))
    expect(bodies).toEqual(Array(3).fill({ status: 404, code: 'HELD_MESSAGE_NOT_FOUND', error: 'This message has already been sent or undone.' }))
  })

  it('rejects an id that is not a uuid before touching anything', async () => {
    const response = await app.request('/held-messages/not-a-uuid/release', { method: 'POST' })
    expect(response.status).toBe(400)
    expect(env.enqueue).not.toHaveBeenCalled()
  })

  it('releases early', async () => {
    const held = await env.hold('test_moved')
    const response = await app.request(`/held-messages/${held.id}/release`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { id: held.id, status: 'releasing' } })
  })
})

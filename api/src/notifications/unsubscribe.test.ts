import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { mapApiError } from '../lib/api-contract'
import { createIpRateLimiter } from '../lib/ip-rate-limit'
import { configureUnsubscribeRoutes, unsubscribeRouter } from '../routes/unsubscribe'
import {
  hashUnsubscribeToken,
  issueUnsubscribeToken,
  lookupUnsubscribe,
  purgeUnsubscribeTokens,
  undoUnsubscribe,
  unsubscribe,
  USED_TOKEN_GRACE_MS,
  type StoredUnsubscribeToken,
  type UnsubscribeStore,
} from './unsubscribe'

/** Mirrors apply_unsubscribe_token: one row per hash, a day of grace after first use. */
function memoryStore(clock: { now: Date }) {
  const tokens = new Map<string, StoredUnsubscribeToken>()
  const preferences = new Map<string, boolean>()
  const inserted: Array<Record<string, unknown>> = []
  const valid = (token: StoredUnsubscribeToken | undefined) => token
    && new Date(token.expiresAt) > clock.now
    && (!token.usedAt || new Date(token.usedAt).getTime() > clock.now.getTime() - USED_TOKEN_GRACE_MS)
  const store: UnsubscribeStore = {
    async insertToken(input) {
      inserted.push(input)
      tokens.set(input.tokenHash, { personId: input.personId, schoolId: input.schoolId, rowKey: input.rowKey, expiresAt: input.expiresAt, usedAt: null })
    },
    async findToken(hash) { return tokens.get(hash) ?? null },
    async emailPreference(personId, schoolId, rowKey) { return preferences.get(`${personId}|${schoolId}|${rowKey}`) ?? null },
    async applyToken(hash, emailOn) {
      const token = tokens.get(hash)
      if (!valid(token)) return null
      token!.usedAt ??= clock.now.toISOString()
      preferences.set(`${token!.personId}|${token!.schoolId}|${token!.rowKey}`, emailOn)
      return { rowKey: token!.rowKey, emailOn }
    },
  }
  return { store, tokens, preferences, inserted }
}

function setup() {
  const clock = { now: new Date('2026-12-01T10:00:00Z') }
  return { clock, ...memoryStore(clock) }
}

describe('unsubscribe tokens (NTF-04, DM-15)', () => {
  it('stores only the sha-256 hash of a 32-byte random token', async () => {
    const { store, inserted, clock } = setup()
    const token = await issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'lesson_reminders' }, store, clock.now)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(inserted).toEqual([{
      personId: 'student-1', schoolId: 'school-1', rowKey: 'lesson_reminders',
      tokenHash: hashUnsubscribeToken(token), expiresAt: '2027-03-01T10:00:00.000Z',
    }])
    expect(JSON.stringify(inserted)).not.toContain(token)
  })

  it('stores a person-wide row without an account', async () => {
    const { store, inserted } = setup()
    await issueUnsubscribeToken({ personId: 'tutor-1', schoolId: 'school-1', rowKey: 'kanvise_tips' }, store)
    expect(inserted[0].schoolId).toBeNull()
  })

  it('refuses rows that have no email', async () => {
    const { store } = setup()
    await expect(issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'student_push' }, store)).rejects.toThrow('no email')
  })

  it('looking up never changes anything', async () => {
    const { store, clock, preferences } = setup()
    const token = await issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'lesson_reminders' }, store, clock.now)
    await expect(lookupUnsubscribe(token, store, clock.now)).resolves.toEqual({ state: 'subscribed', row_label: 'lesson reminder' })
    await lookupUnsubscribe(token, store, clock.now)
    expect(preferences.size).toBe(0)
  })

  it('unsubscribe switches the row off, is safe to repeat, and Undo switches it back', async () => {
    const { store, clock } = setup()
    const token = await issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'lesson_reminders' }, store, clock.now)
    await expect(unsubscribe(token, store)).resolves.toEqual({ state: 'unsubscribed', row_label: 'lesson reminder' })
    await expect(unsubscribe(token, store)).resolves.toEqual({ state: 'unsubscribed', row_label: 'lesson reminder' })
    await expect(lookupUnsubscribe(token, store, clock.now)).resolves.toEqual({ state: 'unsubscribed', row_label: 'lesson reminder' })
    await expect(undoUnsubscribe(token, store)).resolves.toEqual({ state: 'subscribed', row_label: 'lesson reminder' })
  })

  it('expired, used a day ago, unknown and malformed tokens all look the same', async () => {
    const { store, clock } = setup()
    const old = await issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'lesson_reminders' }, store, new Date('2026-08-01T00:00:00Z'))
    const used = await issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'quiz_emails' }, store, clock.now)
    await unsubscribe(used, store)
    clock.now = new Date(clock.now.getTime() + USED_TOKEN_GRACE_MS + 1)
    const answers = await Promise.all([
      lookupUnsubscribe(old, store, clock.now),
      lookupUnsubscribe(used, store, clock.now),
      unsubscribe(used, store),
      lookupUnsubscribe('A'.repeat(43), store, clock.now),
      lookupUnsubscribe('not a token', store, clock.now),
      undoUnsubscribe(undefined, store),
    ])
    expect(answers).toEqual(Array(6).fill({ state: 'expired' }))
  })
})

describe('unsubscribe routes', () => {
  const app = new Hono()
  app.onError(mapApiError)
  app.route('/unsubscribe', unsubscribeRouter)
  let env: ReturnType<typeof setup>
  let token: string
  const post = (path: string, body: unknown) => app.request(`/unsubscribe${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  beforeEach(async () => {
    env = setup()
    configureUnsubscribeRoutes({ store: env.store })
    token = await issueUnsubscribeToken({ personId: 'student-1', schoolId: 'school-1', rowKey: 'lesson_reminders' }, env.store)
  })

  it('lookup, unsubscribe and undo take the token in the body', async () => {
    const lookup = await post('/lookup', { token })
    expect(lookup.headers.get('cache-control')).toBe('no-store')
    expect(await lookup.json()).toEqual({ data: { state: 'subscribed', row_label: 'lesson reminder' } })
    expect(await (await post('', { token })).json()).toEqual({ data: { state: 'unsubscribed', row_label: 'lesson reminder' } })
    expect(await (await post('/undo', { token })).json()).toEqual({ data: { state: 'subscribed', row_label: 'lesson reminder' } })
  })

  it('answers an unknown token like an expired one', async () => {
    const response = await post('', { token: 'B'.repeat(43) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { state: 'expired' } })
  })

  it('rejects a body without a token or with extra fields', async () => {
    expect((await post('', {})).status).toBe(400)
    expect((await post('', { token, person_id: 'x' })).status).toBe(400)
    const notJson = await app.request('/unsubscribe', { method: 'POST', body: 'token=x' })
    expect(notJson.status).toBe(400)
  })

  it('one-click follows RFC 8058', async () => {
    const response = await app.request(`/unsubscribe/one-click?token=${token}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    })
    expect(response.status).toBe(200)
    expect(env.preferences.get('student-1|school-1|lesson_reminders')).toBe(false)
    const wrongBody = await app.request(`/unsubscribe/one-click?token=${token}`, { method: 'POST', body: 'hello' })
    expect(wrongBody.status).toBe(400)
  })

  it('one-click returns 410 and changes nothing when the link does not work', async () => {
    const send = (query: string) => app.request(`/unsubscribe/one-click${query}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    })
    for (const query of ['', '?token=nope', `?token=${'A'.repeat(43)}`, `?token=${'A'.repeat(201)}`]) {
      const response = await send(query)
      expect(response.status).toBe(410)
      expect((await response.json()).code).toBe('LINK_EXPIRED')
    }
    expect(env.preferences.size).toBe(0)
  })

  it('GET never unsubscribes', async () => {
    const response = await app.request(`/unsubscribe/one-click?token=${token}`)
    expect(response.status).toBe(404)
    expect(env.preferences.size).toBe(0)
  })

  it('rate limits the page calls per address', async () => {
    configureUnsubscribeRoutes({ store: env.store, pageLimiter: createIpRateLimiter({ limit: 1, windowMs: 60_000 }) })
    expect((await post('/lookup', { token })).status).toBe(200)
    const limited = await post('/lookup', { token })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).not.toBeNull()
  })
})

describe('purgeUnsubscribeTokens', () => {
  /** Records each delete call's filters and returns canned rows. */
  function fakeClient(rowsPerDelete: number[]) {
    const calls: Array<{ table: string; filters: Array<[string, string, string]> }> = []
    const client = {
      from(table: string) {
        const call = { table, filters: [] as Array<[string, string, string]> }
        calls.push(call)
        const count = rowsPerDelete[calls.length - 1] ?? 0
        const chain = {
          delete: () => chain,
          lte: (column: string, value: string) => { call.filters.push(['lte', column, value]); return chain },
          select: async () => ({ data: Array.from({ length: count }, (_, i) => ({ id: String(i) })), error: null }),
        }
        return chain
      },
    }
    return { client: client as never, calls }
  }

  it('deletes expired tokens and tokens used past the grace window, and counts them', async () => {
    const now = new Date('2027-01-10T12:00:00.000Z')
    const { client, calls } = fakeClient([2, 3])
    expect(await purgeUnsubscribeTokens(client, now)).toBe(5)
    expect(calls.map((call) => call.table)).toEqual(['unsubscribe_tokens', 'unsubscribe_tokens'])
    expect(calls[0].filters).toEqual([['lte', 'expires_at', now.toISOString()]])
    expect(calls[1].filters).toEqual([['lte', 'used_at', new Date(now.getTime() - USED_TOKEN_GRACE_MS).toISOString()]])
  })

  it('throws when the database refuses', async () => {
    const client = { from: () => ({ delete: () => ({ lte: () => ({ select: async () => ({ data: null, error: new Error('db down') }) }) }) }) }
    await expect(purgeUnsubscribeTokens(client as never)).rejects.toThrow('db down')
  })
})

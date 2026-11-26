import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WaitlistStore } from './waitlist'
import { createWaitlistRouter } from './waitlist'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const signup = { id: 'signup-1', created_at: '2026-11-04T08:00:00.000Z' }

function makeStore(overrides: Partial<WaitlistStore> = {}): WaitlistStore {
  return {
    findByEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
    countThrough: vi.fn().mockResolvedValue({ count: 3, error: null }),
    insert: vi.fn().mockResolvedValue({ data: signup, error: null }),
    ...overrides,
  }
}

function post(store: WaitlistStore, body: unknown) {
  return postRaw(store, JSON.stringify(body))
}

function postRaw(store: WaitlistStore, body: string) {
  return createWaitlistRouter(store).request('/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

const validBody = {
  contact_name: 'Ada Lovelace',
  contact_email: 'ada@example.com',
  centre_name: 'Bright Centre',
}

describe('POST /waitlist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires the name, email, and centre', async () => {
    const store = makeStore()

    const response = await post(store, { contact_email: validBody.contact_email })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing required fields' })
    expect(store.findByEmail).not.toHaveBeenCalled()
  })

  it('rejects malformed email addresses', async () => {
    const store = makeStore()

    const response = await post(store, { ...validBody, contact_email: 'not-an-email' })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid waitlist details' })
  })

  it('rejects malformed JSON and non-object bodies before store access', async () => {
    const malformedStore = makeStore()
    const malformed = await postRaw(malformedStore, '{not-json')
    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toEqual({ error: 'Invalid JSON payload' })
    expect(malformedStore.findByEmail).not.toHaveBeenCalled()

    const nullStore = makeStore()
    const nullBody = await post(nullStore, null)
    expect(nullBody.status).toBe(400)
    await expect(nullBody.json()).resolves.toEqual({ error: 'Invalid waitlist payload' })
    expect(nullStore.findByEmail).not.toHaveBeenCalled()
  })

  it.each([
    ['required field', { ...validBody, contact_name: false }, 'Invalid waitlist details'],
    ['student count', { ...validBody, estimated_student_count: false }, 'Invalid estimated student count'],
    ['beta flag', { ...validBody, wants_beta_testing: 'false' }, 'Invalid waitlist details'],
    ['phone', { ...validBody, contact_phone: 12345 }, 'Invalid waitlist details'],
  ])('rejects a wrong %s type before storage', async (_label, body, error) => {
    const store = makeStore()

    const response = await post(store, body)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error })
    expect(store.findByEmail).not.toHaveBeenCalled()
    expect(store.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed', 'many'],
    ['negative', -1],
    ['over the limit', 1_000_001],
  ])('rejects %s student counts', async (_label, count) => {
    const store = makeStore()

    const response = await post(store, { ...validBody, estimated_student_count: count })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid estimated student count' })
    expect(store.insert).not.toHaveBeenCalled()
  })

  it('normalizes once at persistence and returns the compatible success payload', async () => {
    const store = makeStore()

    const response = await post(store, {
      contact_name: '  Ada Lovelace  ',
      contact_email: ' ADA@EXAMPLE.COM ',
      centre_name: '  Bright Centre  ',
      contact_phone: ' +234 800 000 0000 ',
      estimated_student_count: '12',
      wants_beta_testing: true,
    })

    expect(response.status).toBe(201)
    expect(store.findByEmail).toHaveBeenCalledWith('ada@example.com')
    expect(store.insert).toHaveBeenCalledWith({
      contact_name: 'Ada Lovelace',
      contact_email: 'ada@example.com',
      centre_name: 'Bright Centre',
      contact_phone: '+234 800 000 0000',
      estimated_student_count: 12,
      wants_beta_testing: true,
      status: 'pending',
    })
    await expect(response.json()).resolves.toEqual({
      message: 'Successfully joined the waitlist!', position: 3, already_joined: false,
    })
  })

  it('preserves duplicate handling and position', async () => {
    const store = makeStore({
      findByEmail: vi.fn().mockResolvedValue({ data: signup, error: null }),
      countThrough: vi.fn().mockResolvedValue({ count: 7, error: null }),
    })

    const response = await post(store, validBody)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: "You're already on the list!", position: 7, already_joined: true,
    })
    expect(store.insert).not.toHaveBeenCalled()
  })

  it('maps a unique insert race to the compatible duplicate response', async () => {
    const store = makeStore({
      findByEmail: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: signup, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }),
      countThrough: vi.fn().mockResolvedValue({ count: 9, error: null }),
    })

    const response = await post(store, validBody)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ position: 9, already_joined: true })
  })
})

describe('POST /waitlist abuse limits and count errors', () => {
  it('limits repeated submissions per client address', async () => {
    const store = makeStore()
    const router = createWaitlistRouter(store, { hit: vi.fn().mockReturnValueOnce(null).mockReturnValue(42) })
    const send = () => router.request('/waitlist', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody),
    })
    expect((await send()).status).toBe(201)
    const blocked = await send()
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('42')
    expect(store.insert).toHaveBeenCalledTimes(1)
  })

  it('uses the default limiter keyed by client address', async () => {
    const store = makeStore()
    const router = createWaitlistRouter(store)
    let last = 0
    for (let i = 0; i < 31; i += 1) {
      last = (await router.request('/waitlist', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '3.3.3.3' },
        body: JSON.stringify({ ...validBody, contact_email: `u${i}@example.com` }),
      })).status
    }
    expect(last).toBe(429)
  })

  it('logs a failed position count on the duplicate path and still answers', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = makeStore({
      findByEmail: vi.fn().mockResolvedValue({ data: signup, error: null }),
      countThrough: vi.fn().mockResolvedValue({ count: null, error: { message: 'count failed' } }),
    })
    const response = await post(store, validBody)
    expect(response.status).toBe(409)
    expect(error).toHaveBeenCalledWith('Error calculating waitlist position:', expect.objectContaining({ message: 'count failed' }))
    error.mockRestore()
  })
})

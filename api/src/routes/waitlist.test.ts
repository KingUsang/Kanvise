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
  return createWaitlistRouter(store).request('/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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

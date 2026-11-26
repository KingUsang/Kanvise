import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { suggestionsRouter, resetSuggestionLimiter } from './suggestions'

function post(body: unknown, headers: Record<string, string> = {}) {
  return suggestionsRouter.request('/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSuggestionLimiter()
    mocks.insert.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert: mocks.insert })
  })

  it('stores a valid suggestion', async () => {
    const response = await post({ suggestion: ' More mocks ', email: 'a@b.co' })
    expect(response.status).toBe(201)
    expect(mocks.insert).toHaveBeenCalledWith([{ suggestion: 'More mocks', email: 'a@b.co', status: 'pending' }])
  })

  it('accepts the null email the web proxy sends', async () => {
    expect((await post({ suggestion: 'x', email: null })).status).toBe(201)
  })

  it.each([
    ['non-object body', '[1]'],
    ['non-string suggestion', { suggestion: { a: 1 } }],
    ['non-string email', { suggestion: 'x', email: 5 }],
    ['malformed email', { suggestion: 'x', email: 'not-an-email' }],
    ['oversized email', { suggestion: 'x', email: `${'a'.repeat(320)}@b.co` }],
    ['oversized suggestion', { suggestion: 'x'.repeat(2001) }],
    ['unparseable body', '{nope'],
  ])('rejects %s with 400 and stores nothing', async (_l, body) => {
    const response = await post(body)
    expect(response.status).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('limits repeated submissions per client address', async () => {
    for (let i = 0; i < 20; i += 1) expect((await post({ suggestion: 'x' }, { 'x-real-ip': '7.7.7.7' })).status).toBe(201)
    const blocked = await post({ suggestion: 'x' }, { 'x-real-ip': '7.7.7.7' })
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await blocked.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect(mocks.insert).toHaveBeenCalledTimes(20)
    expect((await post({ suggestion: 'x' }, { 'x-real-ip': '8.8.8.8' })).status).toBe(201)
  })
})

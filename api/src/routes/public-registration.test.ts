import { describe, expect, it, vi } from 'vitest'

const insert = vi.fn().mockResolvedValue({ error: null })
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ insert })) } }))

import { publicRegistrationRouter } from './public-registration'

const post = (body: unknown) => publicRegistrationRouter.request('/registration-intents/student', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

describe('student registration intents', () => {
  it('creates an intent for a bounded local return path', async () => {
    const response = await post({ return_to: '/join/abc' })
    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('rejects an oversized return path', async () => {
    const response = await post({ return_to: `/${'a'.repeat(600)}` })
    expect(response.status).toBe(400)
  })

  it('rate limits repeated intent creation from one address', async () => {
    let last = 0
    for (let i = 0; i < 40; i += 1) last = (await post({ return_to: '/join/abc' })).status
    expect(last).toBe(429)
  })
})

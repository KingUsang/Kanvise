import { describe, expect, it } from 'vitest'
import { clientAddress, createIpRateLimiter } from './ip-rate-limit'

describe('createIpRateLimiter', () => {
  it('blocks after the limit and reports seconds to wait', () => {
    const limiter = createIpRateLimiter({ limit: 2, windowMs: 60_000 })
    expect(limiter.hit('a', 0)).toBeNull()
    expect(limiter.hit('a', 1)).toBeNull()
    expect(limiter.hit('a', 2)).toBe(60)
    expect(limiter.hit('b', 2)).toBeNull()
  })

  it('opens a new window after expiry', () => {
    const limiter = createIpRateLimiter({ limit: 1, windowMs: 1_000 })
    limiter.hit('a', 0)
    expect(limiter.hit('a', 500)).not.toBeNull()
    expect(limiter.hit('a', 1_001)).toBeNull()
  })

  it('keeps the number of tracked keys bounded', () => {
    const limiter = createIpRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 })
    for (let i = 0; i < 10; i += 1) limiter.hit(`k${i}`, 0)
    // The oldest keys were evicted, so k0 starts a fresh window.
    expect(limiter.hit('k0', 1)).toBeNull()
  })
})

describe('clientAddress', () => {
  const req = (headers: Record<string, string>) => ({ req: { header: (n: string) => headers[n.toLowerCase()] } })
  it('prefers the edge header and falls back to the last forwarded hop', () => {
    expect(clientAddress(req({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientAddress(req({ 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }))).toBe('2.2.2.2')
    expect(clientAddress(req({}))).toBe('unknown')
  })
})

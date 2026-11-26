import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientAddress, createIpRateLimiter, hasTrustedProxySecret } from './ip-rate-limit'

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

describe('clientAddress (DEV-PUB-004)', () => {
  const secret = 'proxy-secret-for-tests-0123456789'
  const req = (headers: Record<string, string>) => ({ req: { header: (n: string) => headers[n.toLowerCase()] } })

  beforeEach(() => { vi.stubEnv('KANVISE_PROXY_SECRET', secret) })
  afterEach(() => { vi.unstubAllEnvs() })

  it('ignores spoofable edge headers and uses the last forwarded hop', () => {
    expect(clientAddress(req({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '3.3.3.3', 'x-forwarded-for': '2.2.2.2' }))).toBe('2.2.2.2')
    expect(clientAddress(req({ 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }))).toBe('2.2.2.2')
    expect(clientAddress(req({ 'cf-connecting-ip': '1.1.1.1' }))).toBe('unknown')
    expect(clientAddress(req({}))).toBe('unknown')
  })

  it('ignores a forwarded client address without the proxy secret', () => {
    expect(clientAddress(req({ 'x-kanvise-client-ip': '7.7.7.7', 'x-forwarded-for': '2.2.2.2' }))).toBe('2.2.2.2')
    expect(clientAddress(req({ 'x-kanvise-client-ip': '7.7.7.7', 'x-kanvise-proxy-secret': 'wrong', 'x-forwarded-for': '2.2.2.2' }))).toBe('2.2.2.2')
  })

  it('uses the forwarded client address when the proxy secret matches', () => {
    expect(clientAddress(req({ 'x-kanvise-client-ip': '7.7.7.7', 'x-kanvise-proxy-secret': secret, 'x-forwarded-for': '2.2.2.2' }))).toBe('7.7.7.7')
    expect(clientAddress(req({ 'x-kanvise-client-ip': '2001:db8::1', 'x-kanvise-proxy-secret': secret }))).toBe('2001:db8::1')
  })

  it('rejects a malformed forwarded address even with the secret', () => {
    expect(clientAddress(req({ 'x-kanvise-client-ip': 'not an ip', 'x-kanvise-proxy-secret': secret, 'x-forwarded-for': '2.2.2.2' }))).toBe('2.2.2.2')
  })

  it('trusts nobody when the secret is unset or too short', () => {
    vi.stubEnv('KANVISE_PROXY_SECRET', '')
    expect(hasTrustedProxySecret(req({ 'x-kanvise-proxy-secret': '' }))).toBe(false)
    expect(clientAddress(req({ 'x-kanvise-client-ip': '7.7.7.7', 'x-kanvise-proxy-secret': 'anything', 'x-forwarded-for': '2.2.2.2' }))).toBe('2.2.2.2')
    vi.stubEnv('KANVISE_PROXY_SECRET', 'short')
    expect(clientAddress(req({ 'x-kanvise-client-ip': '7.7.7.7', 'x-kanvise-proxy-secret': 'short', 'x-forwarded-for': '2.2.2.2' }))).toBe('2.2.2.2')
  })
})

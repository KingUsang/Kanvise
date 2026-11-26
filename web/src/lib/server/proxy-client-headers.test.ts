import { describe, expect, it, vi } from 'vitest'
import { proxyClientHeaders, visitorAddress } from './proxy-client-headers'

const req = (headers: Record<string, string>) => new Request('https://kanvise.test/api/waitlist', { headers })

describe('proxyClientHeaders (DEV-PUB-004)', () => {
  it('prefers Vercel x-real-ip, then the first x-forwarded-for entry', () => {
    expect(visitorAddress(req({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(visitorAddress(req({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2')
    expect(visitorAddress(req({}))).toBeNull()
  })

  it('sends the visitor address with the proxy secret when configured', () => {
    expect(proxyClientHeaders(req({ 'x-real-ip': '1.1.1.1' }), 'proxy-secret-0123456789')).toEqual({
      'X-Kanvise-Client-Ip': '1.1.1.1',
      'X-Kanvise-Proxy-Secret': 'proxy-secret-0123456789',
    })
  })

  it('sends nothing when the secret is unset or no address is known', () => {
    expect(proxyClientHeaders(req({ 'x-real-ip': '1.1.1.1' }), undefined)).toEqual({})
    expect(proxyClientHeaders(req({ 'x-real-ip': '1.1.1.1' }), '  ')).toEqual({})
    expect(proxyClientHeaders(req({}), 'proxy-secret-0123456789')).toEqual({})
  })

  it('sends nothing and warns once when the secret is shorter than the API minimum', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(proxyClientHeaders(req({ 'x-real-ip': '1.1.1.1' }), 'short-secret')).toEqual({})
    expect(proxyClientHeaders(req({ 'x-real-ip': '1.1.1.1' }), 'short-secret')).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

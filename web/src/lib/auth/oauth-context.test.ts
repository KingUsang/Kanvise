import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createOAuthContext, readOAuthContext } from './oauth-context'

describe('OAuth context', () => {
  beforeEach(() => { process.env.AUTH_CONTEXT_SECRET = 'a-secure-test-secret-that-is-long-enough' })
  afterEach(() => { delete process.env.AUTH_CONTEXT_SECRET })

  it('round trips a safe student continuation', () => {
    const signed = createOAuthContext({ intent: 'student', returnTo: '/school/physics', registrationIntent: 'opaque' }, 1_000)
    expect(readOAuthContext(signed, 2_000)).toMatchObject({ intent: 'student', returnTo: '/school/physics', registrationIntent: 'opaque' })
  })

  it('rejects tampering, expiration, and external redirects', () => {
    const signed = createOAuthContext({ intent: 'login', returnTo: 'https://evil.example' }, 1_000)
    expect(readOAuthContext(`${signed}x`, 2_000)).toBeNull()
    expect(readOAuthContext(signed, 1_000 + 11 * 60_000)).toBeNull()
    expect(readOAuthContext(signed, 2_000)?.returnTo).toBeUndefined()
  })

  it('keeps a tutoring agency name only for the educator agency flow', () => {
    const signed = createOAuthContext({ intent: 'educator', accountType: 'centre', agencyName: ' Bright Future Tutorials ' }, 1_000)
    expect(readOAuthContext(signed, 2_000)?.agencyName).toBe('Bright Future Tutorials')
  })

  it('treats a missing server secret as no OAuth context', () => {
    const signed = createOAuthContext({ intent: 'login' })
    delete process.env.AUTH_CONTEXT_SECRET
    expect(readOAuthContext(signed)).toBeNull()
  })
})

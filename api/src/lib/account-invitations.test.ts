import { describe, expect, it } from 'vitest'
import { accountInvitationStatus, createInvitationToken, invitationTokenHash } from './account-invitations'

describe('durable invitation tokens', () => {
  it('creates URL-safe 256-bit tokens and stores only deterministic hashes', () => {
    const first = createInvitationToken()
    const second = createInvitationToken()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
    expect(invitationTokenHash(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(invitationTokenHash(first)).toBe(invitationTokenHash(first))
    expect(invitationTokenHash(second)).not.toBe(invitationTokenHash(first))
  })

  it.each([
    ['pending', '2026-10-13T00:00:00.000Z', 'pending'],
    ['pending', '2026-10-11T00:00:00.000Z', 'expired'],
    ['accepted', '2026-10-11T00:00:00.000Z', 'accepted'],
    ['revoked', '2026-10-13T00:00:00.000Z', 'revoked'],
  ])('resolves %s invitations with expiry %s as %s', (status, expires_at, expected) => {
    expect(accountInvitationStatus({ status, expires_at }, Date.parse('2026-10-12T00:00:00.000Z'))).toBe(expected)
  })
})

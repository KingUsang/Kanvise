import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateInviteToken, validateInviteToken } from './invites'

describe('tutor invite tokens', () => {
  beforeEach(() => {
    vi.stubEnv('INVITE_TOKEN_SECRET', 'a-long-test-only-invite-secret')
  })

  it('binds a signed token to the invite row, school and normalized email', () => {
    const token = generateInviteToken('invite-1', 'school-1', ' Tutor@Example.com ')

    expect(validateInviteToken(token)).toMatchObject({
      invite_id: 'invite-1',
      school_id: 'school-1',
      email: 'tutor@example.com',
    })
  })

  it('rejects a token whose payload was changed', () => {
    const token = generateInviteToken('invite-1', 'school-1', 'tutor@example.com')
    const [payload, signature] = token.split('.')
    const changed = Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
      school_id: 'another-school',
    })).toString('base64url')

    expect(() => validateInviteToken(`${changed}.${signature}`)).toThrow('INVALID_INVITE_TOKEN')
  })
})

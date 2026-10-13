import { describe, expect, it } from 'vitest'
import { readInvitationSessionFragment } from './invitation-session'

describe('readInvitationSessionFragment', () => {
  it('reads the implicit invitation session tokens', () => {
    expect(readInvitationSessionFragment('#access_token=access.jwt&refresh_token=refresh-token&token_type=bearer')).toEqual({
      accessToken: 'access.jwt',
      refreshToken: 'refresh-token',
      error: null,
    })
  })

  it('returns the provider error without exposing token values', () => {
    expect(readInvitationSessionFragment('#error=access_denied&error_description=Email+link+is+invalid')).toEqual({
      accessToken: null,
      refreshToken: null,
      error: 'Email link is invalid',
    })
  })

  it('rejects an incomplete fragment', () => {
    expect(readInvitationSessionFragment('#access_token=access.jwt')).toEqual({
      accessToken: null,
      refreshToken: null,
      error: 'Your invitation link did not contain a complete sign-in session.',
    })
  })
})

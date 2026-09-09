import { describe, expect, it } from 'vitest'
import { loginHref, postAuthDestination, studentRegisterHref } from './auth-continuation'

describe('postAuthDestination', () => {
  it('returns a signed-in student to the exact safe destination', () => {
    expect(postAuthDestination({ role: 'student', redirect: '/mock/biology?checkout=true#offer' }))
      .toBe('/mock/biology?checkout=true#offer')
  })

  it('does not send staff accounts into a student purchase flow', () => {
    expect(postAuthDestination({ role: 'tutor', redirect: '/mock/biology' })).toBe('/dashboard')
  })

  it('preserves invite acceptance for an existing account', () => {
    expect(postAuthDestination({ role: 'student', redirect: '/join?token=invite-token' }))
      .toBe('/join?token=invite-token')
  })

  it('keeps a centre admin without a centre in setup', () => {
    expect(postAuthDestination({ role: 'admin', schoolId: null, redirect: '/mock/biology' }))
      .toBe('/dashboard/school-setup')
  })

  it('rejects external redirects', () => {
    expect(postAuthDestination({ role: 'student', redirect: '//evil.example/steal' }))
      .toBe('/dashboard/student')
  })
})

describe('auth flow links', () => {
  it('carries student flow, intent and exact continuation through login', () => {
    expect(loginHref({ redirect: '/mock/biology?checkout=true', flow: 'student', intent: 'one-time-intent' }))
      .toBe('/auth/login?redirect=%2Fmock%2Fbiology%3Fcheckout%3Dtrue&flow=student&intent=one-time-intent')
  })

  it('carries the intent back to student registration', () => {
    expect(studentRegisterHref({ redirect: '/mock/biology', intent: 'one-time-intent' }))
      .toBe('/auth/register/student?intent=one-time-intent&return_to=%2Fmock%2Fbiology')
  })
})

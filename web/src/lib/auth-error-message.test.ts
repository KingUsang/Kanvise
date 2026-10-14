import { describe, expect, it } from 'vitest'
import {
  passwordUpdateErrorMessage,
  recoveryRequestErrorMessage,
  signInErrorMessage,
  signUpErrorMessage,
  verificationErrorMessage,
} from './auth-error-message'

describe('auth error messages', () => {
  it('maps known authentication failures to useful copy', () => {
    expect(signInErrorMessage({ code: 'invalid_credentials', message: 'provider detail' })).toContain('Check your email and password')
    expect(signUpErrorMessage({ code: 'weak_password', message: 'provider detail' })).toContain('requirements')
    expect(verificationErrorMessage({ code: 'otp_expired', message: 'provider detail' })).toContain('expired')
    expect(recoveryRequestErrorMessage({ code: 'over_email_send_rate_limit' })).toContain('Wait a moment')
    expect(passwordUpdateErrorMessage({ code: 'weak_password' })).toContain('requirements')
  })

  it('never exposes an unknown provider message', () => {
    const providerMessage = 'sensitive provider implementation detail'
    expect(signInErrorMessage({ message: providerMessage })).not.toContain(providerMessage)
    expect(signUpErrorMessage({ message: providerMessage })).not.toContain(providerMessage)
    expect(verificationErrorMessage({ message: providerMessage })).not.toContain(providerMessage)
    expect(recoveryRequestErrorMessage({ message: providerMessage })).not.toContain(providerMessage)
    expect(passwordUpdateErrorMessage({ message: providerMessage })).not.toContain(providerMessage)
  })
})

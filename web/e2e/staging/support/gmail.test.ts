import { describe, expect, it } from 'vitest'
import { invitationLinkFromMessage, messageText, taggedMailbox, verificationCodeFromMessage } from './gmail'

const encoded = (value: string) => Buffer.from(value).toString('base64url')

describe('Gmail staging adapter', () => {
  it('builds a run-specific plus address', () => {
    expect(taggedMailbox('qa+old@gmail.com', 'E2E-42-1', 'Admin')).toBe('qa+e2e-42-1-admin@gmail.com')
  })

  it('reads multipart base64url messages and extracts the labelled OTP', () => {
    const payload = { parts: [
      { mimeType: 'text/plain', body: { data: encoded('Your verification code is 482913.') } },
      { mimeType: 'text/html', body: { data: encoded('<p>Ignore 123456 in this footer</p>') } },
    ] }
    expect(messageText(payload)).toContain('482913')
    expect(verificationCodeFromMessage({ id: 'gmail-1', payload })).toBe('482913')
  })

  it('fails when the delivered message has no verification code', () => {
    expect(() => verificationCodeFromMessage({ id: 'gmail-2', payload: { body: { data: encoded('Welcome') } } })).toThrow(/did not contain/)
  })

  it('extracts only the staging invitation URL', () => {
    const payload = { body: { data: encoded('Open https://staging.kanvise.com/invite?token=abc123&amp;source=email') } }
    expect(invitationLinkFromMessage({ id: 'gmail-3', payload }, 'https://staging.kanvise.com')).toBe('https://staging.kanvise.com/invite?token=abc123&source=email')
    expect(() => invitationLinkFromMessage({ id: 'gmail-3', payload }, 'https://kanvise.com')).toThrow(/did not contain/)
  })
})

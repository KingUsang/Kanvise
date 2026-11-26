import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { classShareUrl, decryptClassLinkToken, encryptClassLinkToken } from './class-links'

const previousKey = process.env.CLASS_LINK_ENCRYPTION_KEY
const previousFrontend = process.env.FRONTEND_URL

afterEach(() => {
  if (previousKey === undefined) delete process.env.CLASS_LINK_ENCRYPTION_KEY
  else process.env.CLASS_LINK_ENCRYPTION_KEY = previousKey
  if (previousFrontend === undefined) delete process.env.FRONTEND_URL
  else process.env.FRONTEND_URL = previousFrontend
})

describe('class link recovery', () => {
  it('encrypts the guest token at rest and restores only the public URL', () => {
    process.env.CLASS_LINK_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    process.env.FRONTEND_URL = 'https://staging.kanvise.com/'
    const token = 'guest_link_token_that_is_not_stored_in_plaintext'
    const encrypted = encryptClassLinkToken(token)

    expect(encrypted).not.toContain(token)
    expect(decryptClassLinkToken(encrypted!)).toBe(token)
    expect(classShareUrl({ id: 'class-1', access_mode: 'anyone_with_link', share_token_encrypted: encrypted }))
      .toBe(`https://staging.kanvise.com/live/${token}`)
  })

  it('uses the stable class route for enrolled classrooms', () => {
    process.env.FRONTEND_URL = 'https://kanvise.com'
    expect(classShareUrl({ id: 'class-1', access_mode: 'enrolled_learners' }))
      .toBe('https://kanvise.com/class/class-1')
  })
})

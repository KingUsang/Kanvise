import { describe, expect, it } from 'vitest'
import { getEmailConfig } from './config'

describe('getEmailConfig', () => {
  it('uses the deployed Next.js logo when EMAIL_LOGO_URL is omitted', () => {
    expect(getEmailConfig({
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kanvise <noreply@kanvise.com>',
      FRONTEND_URL: 'https://kanvise.com/',
    } as NodeJS.ProcessEnv)).toEqual({
      apiKey: 're_test',
      from: 'Kanvise <noreply@kanvise.com>',
      replyTo: undefined,
      logoUrl: 'https://kanvise.com/kanvise_logo_small_blue.png',
    })
  })

  it.each(['RESEND_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL'])('requires %s', (missing) => {
    const env: NodeJS.ProcessEnv = {
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kanvise <noreply@kanvise.com>',
      FRONTEND_URL: 'https://kanvise.com',
    }
    delete env[missing]

    expect(() => getEmailConfig(env)).toThrow(`${missing} is required`)
  })

  it.each(['FRONTEND_URL', 'RESEND_API_KEY', 'EMAIL_FROM'] as const)('rejects missing %s', (missing) => {
    const env = {
      FRONTEND_URL: 'https://kanvise.com',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kanvise <noreply@kanvise.com>',
    } as NodeJS.ProcessEnv
    delete env[missing]
    expect(() => getEmailConfig(env)).toThrow(`${missing} is required for email delivery`)
  })
})

import { describe, expect, it } from 'vitest'
import { getEmailConfig } from './config'

describe('getEmailConfig', () => {
  it('uses the deployed Next.js logo when EMAIL_LOGO_URL is omitted', () => {
    expect(getEmailConfig({
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kanvise <noreply@kanvise.com>',
      FRONTEND_URL: 'https://kanvise.com/',
    } as NodeJS.ProcessEnv)).toEqual({
      resendApiKey: 're_test',
      brevoApiKey: undefined,
      providerOrder: ['resend'],
      providerTimeoutMs: 3500,
      from: 'Kanvise <noreply@kanvise.com>',
      replyTo: undefined,
      logoUrl: 'https://kanvise.com/kanvise_logo_small_blue.png',
    })
  })

  it.each(['EMAIL_FROM', 'FRONTEND_URL'])('requires %s', (missing) => {
    const env: NodeJS.ProcessEnv = {
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kanvise <noreply@kanvise.com>',
      FRONTEND_URL: 'https://kanvise.com',
    }
    delete env[missing]

    expect(() => getEmailConfig(env)).toThrow(`${missing} is required`)
  })

  it.each(['FRONTEND_URL', 'EMAIL_FROM'] as const)('rejects missing %s', (missing) => {
    const env = {
      FRONTEND_URL: 'https://kanvise.com',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kanvise <noreply@kanvise.com>',
    } as NodeJS.ProcessEnv
    delete env[missing]
    expect(() => getEmailConfig(env)).toThrow(`${missing} is required for email delivery`)
  })

  it('accepts Brevo as the only configured provider', () => {
    expect(getEmailConfig({
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Kanvise <noreply@mail.kanvise.com>',
      FRONTEND_URL: 'https://kanvise.com',
    } as NodeJS.ProcessEnv)).toMatchObject({
      resendApiKey: undefined,
      brevoApiKey: 'xkeysib-test',
      providerOrder: ['brevo'],
    })
  })

  it('requires at least one email provider', () => {
    expect(() => getEmailConfig({
      EMAIL_FROM: 'Kanvise <noreply@mail.kanvise.com>',
      FRONTEND_URL: 'https://kanvise.com',
    } as NodeJS.ProcessEnv)).toThrow('RESEND_API_KEY or BREVO_API_KEY is required')
  })
})

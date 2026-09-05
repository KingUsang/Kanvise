import { describe, expect, it } from 'vitest'
import { isTelegramEnabled, isWebPushEnabled, validateProductionEnvironment } from './runtime-env'

const validProductionEnv = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PAYSTACK_SECRET_KEY: 'paystack-production-secret-for-tests-only',
  KANVISE_INTERNAL_SECRET: 'internal-secret-1234567890123456',
  INVITE_TOKEN_SECRET: 'invite-secret',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'private',
  R2_PUBLIC_BUCKET_NAME: 'public',
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
  LIVEKIT_URL: 'wss://livekit.example.com',
  LIVEKIT_API_KEY: 'livekit-key',
  LIVEKIT_API_SECRET: 'livekit-secret',
  RESEND_API_KEY: 're_live',
  EMAIL_FROM: 'Kanvise <noreply@example.com>',
  GEMINI_API_KEY: 'gemini-key',
  FRONTEND_URL: 'https://www.example.com',
  CORS_ALLOWED_ORIGINS: 'https://www.example.com,https://admin.example.com',
  PORT: '3001',
} as NodeJS.ProcessEnv

describe('validateProductionEnvironment', () => {
  it('does not enforce production variables in non-production environments', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'staging' } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('accepts the complete core production environment with Telegram disabled', () => {
    expect(() => validateProductionEnvironment(validProductionEnv)).not.toThrow()
  })

  it('reports all missing core production variables together', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'production' } as NodeJS.ProcessEnv))
      .toThrow(/EMAIL_FROM.*GEMINI_API_KEY.*KANVISE_INTERNAL_SECRET/)
  })

  it('requires Telegram secrets only when Telegram is enabled', () => {
    expect(() => validateProductionEnvironment({ ...validProductionEnv, TELEGRAM_ENABLED: 'true' }))
      .toThrow('TELEGRAM_BOT_TOKEN')
  })

  it('rejects insecure production origins', () => {
    expect(() => validateProductionEnvironment({ ...validProductionEnv, FRONTEND_URL: 'http://example.com' }))
      .toThrow('FRONTEND_URL must use HTTPS')
  })
})

describe('isTelegramEnabled', () => {
  it('is opt-in', () => {
    expect(isTelegramEnabled({} as NodeJS.ProcessEnv)).toBe(false)
    expect(isTelegramEnabled({ TELEGRAM_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true)
  })
})

describe('web push production configuration', () => {
  it('is opt-in', () => {
    expect(isWebPushEnabled({} as NodeJS.ProcessEnv)).toBe(false)
    expect(isWebPushEnabled({ WEB_PUSH_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('requires VAPID settings only when enabled', () => {
    expect(() => validateProductionEnvironment({ ...validProductionEnv, WEB_PUSH_ENABLED: 'true' }))
      .toThrow('WEB_PUSH_SUBJECT')
    expect(() => validateProductionEnvironment({
      ...validProductionEnv,
      WEB_PUSH_ENABLED: 'true',
      WEB_PUSH_VAPID_PUBLIC_KEY: 'public',
      WEB_PUSH_VAPID_PRIVATE_KEY: 'private',
      WEB_PUSH_SUBJECT: 'mailto:notifications@kanvise.com',
    })).not.toThrow()
  })
})

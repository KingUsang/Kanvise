import webpush from 'web-push'
import { getPushConfig } from '../push/config'
import { vapidKeysMatch } from '../push/vapid'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { CORE_PRODUCTION_VARIABLES, isWebPushEnabled, validateProductionEnvironment } from './runtime-env'

const validProductionEnv = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PAYSTACK_SECRET_KEY: 'paystack-production-secret-for-tests-only',
  KANVISE_INTERNAL_SECRET: 'internal-secret-1234567890123456',
  CLASS_LINK_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'private',
  R2_PUBLIC_BUCKET_NAME: 'public',
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
  PLUGNMEET_SERVER_URL: 'https://plugnmeet.example.com',
  PLUGNMEET_API_KEY: 'plugnmeet-key',
  PLUGNMEET_API_SECRET: 'plugnmeet-secret',
  PLUGNMEET_WEBHOOK_SECRET: 'plugnmeet-webhook-secret',
  RESEND_API_KEY: 're_live',
  EMAIL_FROM: 'Kanvise <noreply@example.com>',
  GEMINI_API_KEY: 'gemini-key',
  FRONTEND_URL: 'https://www.example.com',
  CORS_ALLOWED_ORIGINS: 'https://www.example.com,https://admin.example.com',
  PORT: '3001',
} as NodeJS.ProcessEnv

describe('validateProductionEnvironment', () => {
  it('keeps the API environment example aligned with the production contract', () => {
    const example = readFileSync(fileURLToPath(new URL('../../.env.example', import.meta.url)), 'utf8')
    const exampleKeys = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]))

    expect(CORE_PRODUCTION_VARIABLES.filter((name) => !exampleKeys.has(name))).toEqual([])
    expect(example).not.toMatch(/^LIVEKIT_[A-Z0-9_]*=/m)
  })

  it('does not enforce production variables in non-production environments', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'staging' } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('accepts the complete core production environment', () => {
    expect(() => validateProductionEnvironment(validProductionEnv)).not.toThrow()
  })

  it('reports all missing core production variables together', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'production' } as NodeJS.ProcessEnv))
      .toThrow(/EMAIL_FROM.*GEMINI_API_KEY.*KANVISE_INTERNAL_SECRET/)
  })

  it('requires FRONTEND_URL on its own, because emails and notification links throw without it', () => {
    const { FRONTEND_URL: _omitted, ...withoutFrontendUrl } = validProductionEnv
    expect(() => validateProductionEnvironment(withoutFrontendUrl as NodeJS.ProcessEnv))
      .toThrow('Missing production environment variables: FRONTEND_URL')
    expect(() => validateProductionEnvironment({ ...validProductionEnv, FRONTEND_URL: '  ' }))
      .toThrow('Missing production environment variables: FRONTEND_URL')
  })

  it('makes the Oracle deploy script refuse an API .env without FRONTEND_URL', () => {
    const script = readFileSync(fileURLToPath(new URL('../../../scripts/operations/deploy-api-on-oracle.sh', import.meta.url)), 'utf8')
    expect(script).toMatch(/grep -Eq '[^']*FRONTEND_URL=[^']*' "\$\{deploy_root\}\/api\/\.env"/)
    expect(script).toContain('FRONTEND_URL must be set')
  })

  it('rejects insecure production origins', () => {
    expect(() => validateProductionEnvironment({ ...validProductionEnv, FRONTEND_URL: 'http://example.com' }))
      .toThrow('FRONTEND_URL must use HTTPS')
  })

  it('warns without failing when KANVISE_PROXY_SECRET is shorter than the trusted minimum', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => validateProductionEnvironment({ ...validProductionEnv, KANVISE_PROXY_SECRET: 'short' })).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('KANVISE_PROXY_SECRET'))
    warn.mockClear()
    validateProductionEnvironment({ ...validProductionEnv, KANVISE_PROXY_SECRET: 'proxy-secret-0123456789' })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
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
    const keys = webpush.generateVAPIDKeys()
    const enabled = {
      ...validProductionEnv,
      WEB_PUSH_ENABLED: 'true',
      WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: keys.privateKey,
      WEB_PUSH_SUBJECT: 'mailto:notifications@kanvise.com',
    }
    expect(() => validateProductionEnvironment(enabled)).not.toThrow()
    expect(getPushConfig(enabled).enabled).toBe(true)
  })

  it('rejects a mismatched or malformed VAPID pair (DEV-PSH-004)', () => {
    const a = webpush.generateVAPIDKeys()
    const b = webpush.generateVAPIDKeys()
    const mismatched = {
      ...validProductionEnv,
      WEB_PUSH_ENABLED: 'true',
      WEB_PUSH_VAPID_PUBLIC_KEY: a.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: b.privateKey,
      WEB_PUSH_SUBJECT: 'mailto:notifications@kanvise.com',
    }
    expect(() => validateProductionEnvironment(mismatched)).toThrow('VAPID')
    expect(getPushConfig(mismatched).enabled).toBe(false)
    expect(vapidKeysMatch('public', 'private')).toBe(false)
  })
})

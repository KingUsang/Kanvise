import { createHmac, timingSafeEqual } from 'node:crypto'
import { safeRedirectPath } from '@/lib/safe-redirect'

export const OAUTH_CONTEXT_COOKIE = 'kanvise_oauth_context'
export const OAUTH_CONTEXT_TTL_SECONDS = 10 * 60

export type OAuthIntent = 'login' | 'educator' | 'student' | 'invitation'

export type OAuthContext = {
  intent: OAuthIntent
  returnTo?: string
  registrationIntent?: string
  invitationToken?: string
  accountType?: 'independent' | 'centre'
  agencyName?: string
  issuedAt: number
  expiresAt: number
}

function secret() {
  const value = process.env.AUTH_CONTEXT_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_CONTEXT_SECRET must contain at least 32 characters')
  return value
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createOAuthContext(input: Omit<OAuthContext, 'issuedAt' | 'expiresAt'>, now = Date.now()) {
  const context: OAuthContext = {
    ...input,
    returnTo: safeRedirectPath(input.returnTo) || undefined,
    issuedAt: now,
    expiresAt: now + OAUTH_CONTEXT_TTL_SECONDS * 1000,
  }
  if (context.agencyName) context.agencyName = context.agencyName.trim().slice(0, 120) || undefined
  const payload = encode(JSON.stringify(context))
  return `${payload}.${signature(payload)}`
}

export function readOAuthContext(value: string | undefined, now = Date.now()): OAuthContext | null {
  if (!value || !process.env.AUTH_CONTEXT_SECRET) return null
  const [payload, suppliedSignature, extra] = value.split('.')
  if (!payload || !suppliedSignature || extra) return null
  const expected = signature(payload)
  const suppliedBuffer = Buffer.from(suppliedSignature)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null
  try {
    const context = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthContext
    if (!['login', 'educator', 'student', 'invitation'].includes(context.intent)) return null
    if (!Number.isFinite(context.expiresAt) || context.expiresAt <= now) return null
    if (context.returnTo && !safeRedirectPath(context.returnTo)) return null
    if (context.intent === 'student' && !context.registrationIntent) return null
    if (context.intent === 'invitation' && !context.invitationToken) return null
    if (context.agencyName && (context.intent !== 'educator' || context.accountType !== 'centre')) return null
    return context
  } catch {
    return null
  }
}

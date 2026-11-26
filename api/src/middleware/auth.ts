import { Context, Next } from 'hono'
import * as Sentry from '@sentry/node'
import { supabase } from '../lib/supabase'
import type { AccountContext, MembershipRole } from '../types'

import { createJwtVerifier } from './jwt-verifier'

export type Variables = {
  user: any;
  jwt_payload: any;
  account: AccountContext;
  tenant: { id: string };
};

function setSentryUserContext(user: { id?: string; kanvise_user_id?: string; school_id?: string | null }) {
  const userId = user.kanvise_user_id ?? user.id
  if (userId) Sentry.setUser({ id: userId })
  if (user.school_id) Sentry.setTag('school_id', user.school_id)
}

const verifyJWT = createJwtVerifier({ supabaseUrl: process.env.SUPABASE_URL || '' })

export const jwtVerificationMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorisation header', code: 'MISSING_AUTH' }, 401)
  }
  
  const token = authHeader.split(' ')[1]
  try {
    const payload = await verifyJWT(token)
    c.set('jwt_payload', payload)
    await next()
  } catch (error: any) {
    console.error('[JWT] Verification failed:', error?.name || 'unknown')
    if (error.name === 'JwtTokenExpired') {
      return c.json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' }, 401)
    }
    return c.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, 401)
  }
}

export const profileResolutionMiddleware = async (c: Context, next: Next) => {
  const jwtPayload = c.get('jwt_payload')
  const supabaseAuthId = jwtPayload?.sub
  if (!supabaseAuthId) {
    return c.json({ error: 'Invalid verified identity', code: 'INVALID_IDENTITY' }, 401)
  }

  const isProfileInit = c.req.method === 'POST' && c.req.path === '/auth/profile/init'
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, role, school_id, kanvise_user_id, first_name, last_name, email, is_active, onboarding_status')
    .eq('supabase_auth_id', supabaseAuthId)
    .maybeSingle()

  if (error) {
    return c.json({ error: 'Could not resolve your profile right now', code: 'PROFILE_LOOKUP_FAILED' }, 503)
  }

  if (!profile) {
    if (isProfileInit) {
      c.set('user', { supabase_auth_id: supabaseAuthId, email: jwtPayload.email || null })
      return await next()
    }
    return c.json({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND' }, 403)
  }

  if (profile.is_active !== true) {
    return c.json({ error: 'This account has been deactivated', code: 'ACCOUNT_INACTIVE' }, 403)
  }

  const invitationCompletion = c.req.path.includes('/auth/profile/activate') || c.req.path.includes('/auth/profile/init')
  if (profile.role === 'student' && profile.onboarding_status !== 'active' && !invitationCompletion) {
    return c.json({ error: 'Accept your invitation to finish setting up this account', code: 'ACCOUNT_PENDING' }, 403)
  }
  
  const resolvedUser = {
    id: profile.id,
    supabase_auth_id: supabaseAuthId,
    role: profile.role,
    school_id: profile.school_id,
    kanvise_user_id: profile.kanvise_user_id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email || jwtPayload.email || null,
  }
  c.set('user', resolvedUser)
  setSentryUserContext(resolvedUser)

  await next()
}

export const tenantMiddleware = async (c: Context, next: Next) => {
  const user = c.get('user')
  const allowedWithoutSchool = [
    'POST /auth/profile/init',
    'POST /schools',
    'GET /auth/me',
    'PATCH /auth/me'
  ]
  
  const currentRoute = `${c.req.method} ${c.req.path}`
  
  if (!user.school_id && !allowedWithoutSchool.includes(currentRoute)) {
    return c.json({
      error: 'School not configured. Complete school setup first.',
      code: 'SCHOOL_NOT_CONFIGURED'
    }, 403)
  }
  
  await next()
}

export const ACCOUNT_CONTEXT_HEADER = 'X-Kanvise-Account-Id'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isMembershipRole(value: unknown): value is MembershipRole {
  return value === 'admin' || value === 'tutor' || value === 'learner'
}

/**
 * Resolve the account named by the request, never by profile/JWT projections.
 * The membership and active-account reads intentionally happen on every
 * protected request so revocation is effective without waiting for a token
 * refresh. The selected account ID is a request hint, not proof of access.
 */
export const accountContextMiddleware = async (c: Context, next: Next) => {
  const rawHeader = c.req.header(ACCOUNT_CONTEXT_HEADER)
  if (rawHeader === undefined) {
    return resolveDefaultAccountContext(c, next)
  }
  const accountId = rawHeader.trim()
  if (!UUID_PATTERN.test(accountId)) {
    return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  }
  return resolveAccountContext(c, next, accountId)
}

export type DefaultAccountLookup =
  | { kind: 'single'; accountId: string }
  | { kind: 'several' }
  | { kind: 'none' }
  | { kind: 'error' }

/**
 * Looks up the caller's active memberships (any role) when the request names
 * no account. The API is on a different site from the web app, so it does not
 * read the web's selection cookie; callers send the header and this is only
 * the safety net for requests that cannot (for example a first request before
 * the client has stored a selection).
 */
export async function lookupDefaultAccount(personId: string): Promise<DefaultAccountLookup> {
  const { data, error } = await supabase
    .from('account_memberships')
    .select('school_id')
    .eq('person_id', personId)
    .eq('status', 'active')
    .limit(2)
  if (error) return { kind: 'error' }
  if (!data?.length) return { kind: 'none' }
  if (data.length > 1) return { kind: 'several' }
  return { kind: 'single', accountId: data[0].school_id }
}

export const accountContextUnavailable = (c: Context) =>
  c.json({ error: 'Could not verify the selected tutoring account', code: 'ACCOUNT_CONTEXT_UNAVAILABLE' }, 503)

export const accountSelectionRequired = (c: Context) =>
  c.json({ error: 'Choose which tutoring account to use', code: 'ACCOUNT_SELECTION_REQUIRED' }, 409)

const noAccountContext = (c: Context) =>
  c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)

/**
 * With no header: exactly one active membership is used (and still verified
 * by resolveAccountContext), several return ACCOUNT_SELECTION_REQUIRED so the
 * web shows the account picker, none returns ACCOUNT_CONTEXT_REQUIRED.
 */
export const resolveDefaultAccountContext = async (c: Context, next: Next) => {
  const user = c.get('user')
  if (!user?.id) return noAccountContext(c)
  const lookup = await lookupDefaultAccount(user.id)
  if (lookup.kind === 'error') return accountContextUnavailable(c)
  if (lookup.kind === 'several') return accountSelectionRequired(c)
  if (lookup.kind === 'none') return noAccountContext(c)
  return resolveAccountContext(c, next, lookup.accountId)
}

/** Verifies the caller's active membership of `accountId` and sets the account context. */
export const resolveAccountContext = async (c: Context, next: Next, accountId: string) => {
  const user = c.get('user')

  const { data: membership, error: membershipError } = await supabase
    .from('account_memberships')
    .select('id, school_id, role, status')
    .eq('person_id', user.id)
    .eq('school_id', accountId)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) {
    return c.json({ error: 'Could not verify the selected tutoring account', code: 'ACCOUNT_CONTEXT_UNAVAILABLE' }, 503)
  }
  if (!membership || !isMembershipRole(membership.role)) {
    return c.json({ error: 'You are not an active member of this tutoring account', code: 'ACCOUNT_ACCESS_DENIED' }, 403)
  }

  const { data: account, error: accountError } = await supabase
    .from('schools')
    .select('id')
    .eq('id', accountId)
    .eq('is_active', true)
    .maybeSingle()

  if (accountError) {
    return c.json({ error: 'Could not verify the selected tutoring account', code: 'ACCOUNT_CONTEXT_UNAVAILABLE' }, 503)
  }
  if (!account) {
    return c.json({ error: 'This tutoring account is unavailable', code: 'ACCOUNT_ACCESS_DENIED' }, 403)
  }

  const context: AccountContext = {
    id: account.id,
    membershipId: membership.id,
    role: membership.role,
  }
  c.set('account', context)
  c.set('tenant', { id: context.id })
  await next()
}

export const requireMembershipRole = (...roles: MembershipRole[]) => async (c: Context, next: Next) => {
  const account = c.get('account') as AccountContext | undefined
  if (!account || !roles.includes(account.role)) {
    return c.json({ error: 'This action is not available for your account membership', code: 'INSUFFICIENT_ROLE' }, 403)
  }
  await next()
}

export const requireRole = (...roles: string[]) => async (c: Context, next: Next) => {
  const user = c.get('user')
  
  if (!roles.includes(user.role)) {
    return c.json({
      error: `This action requires one of: ${roles.join(', ')}`,
      code: 'INSUFFICIENT_ROLE'
    }, 403)
  }
  
  await next()
}

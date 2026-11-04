import { Context, Next } from 'hono'
import * as Sentry from '@sentry/node'
import { supabase } from '../lib/supabase'

import { createJwtVerifier } from './jwt-verifier'

export type Variables = {
  user: any;
  jwt_payload: any;
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
    .select('id, role, school_id, kanvise_user_id, first_name, last_name, email, is_active')
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

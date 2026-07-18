import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { supabase } from '../lib/supabase'

import { decode, verifyWithJwks } from 'hono/jwt'

export type Variables = {
  user: any;
  jwt_payload: any;
};

// In-memory cache for JWKS public keys — fetched once on first request, reused forever
// (until server restarts). Supabase rarely rotates keys.
let cachedJwks: any[] | null = null

async function getJwks(): Promise<any[]> {
  if (cachedJwks) return cachedJwks

  // Per Supabase docs: https://supabase.com/docs/guides/auth/jwks
  // The correct public JWKS endpoint path is /.well-known/jwks.json — no auth header needed
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)

  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from Supabase: ${res.status} ${await res.text()}`)
  }

  const { keys } = await res.json() as { keys: any[] }
  cachedJwks = keys
  console.log(`[JWT] Fetched and cached ${keys.length} JWKS key(s)`)
  return cachedJwks!
}

// Handles both HS256 (legacy Supabase) and ES256 (new Supabase projects)
const verifyJWT = async (token: string, secret: string) => {
  const { header } = decode(token)

  if (header.alg === 'HS256') {
    // Legacy symmetric encryption — use the shared JWT secret
    return await verify(token, secret, 'HS256')
  }

  // Asymmetric algorithm (ES256 etc.) — verify against Supabase public keys
  const keys = await getJwks()
  return await verifyWithJwks(token, {
    keys,
    allowedAlgorithms: [header.alg] as any
  })
}

export const jwtVerificationMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorisation header', code: 'MISSING_AUTH' }, 401)
  }
  
  const token = authHeader.split(' ')[1]
  try {
    const secret = process.env.SUPABASE_JWT_SECRET
    const payload = await verifyJWT(token, secret as string)
    c.set('jwt_payload', payload)
    await next()
  } catch (error: any) {
    console.error('[JWT] Verification failed:', error)
    if (error.name === 'JwtTokenExpired') {
      return c.json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' }, 401)
    }
    return c.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, 401)
  }
}

export const profileResolutionMiddleware = async (c: Context, next: Next) => {
  const jwtPayload = c.get('jwt_payload')
  const supabaseAuthId = jwtPayload.sub
  
  // Fast path - metadata is populated
  const userMetadata = jwtPayload.user_metadata || {}
  const { kanvise_role, school_id, kanvise_user_id, profile_id } = userMetadata
  
  if (kanvise_role && kanvise_user_id && profile_id) {
    c.set('user', {
      id: profile_id,
      supabase_auth_id: supabaseAuthId,
      role: kanvise_role,
      school_id: school_id || null,
      kanvise_user_id: kanvise_user_id
    })
    return await next()
  }
  
  // Slow path - lookup from DB
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, role, school_id, kanvise_user_id, first_name, last_name')
    .eq('supabase_auth_id', supabaseAuthId)
    .single()
    
  if (error || !profile) {
    // If it's the init profile endpoint, the user doesn't have a profile yet but needs to pass through
    if (c.req.path.includes('/auth/profile/init')) {
      c.set('user', { supabase_auth_id: supabaseAuthId })
      return await next()
    }
    return c.json({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND' }, 403)
  }
  
  c.set('user', {
    id: profile.id,
    supabase_auth_id: supabaseAuthId,
    role: profile.role,
    school_id: profile.school_id,
    kanvise_user_id: profile.kanvise_user_id,
    first_name: profile.first_name,
    last_name: profile.last_name
  })
  
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

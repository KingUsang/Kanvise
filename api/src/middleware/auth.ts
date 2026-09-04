import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { supabase } from '../lib/supabase'

import { decode, verifyWithJwks } from 'hono/jwt'

export type Variables = {
  user: any;
  jwt_payload: any;
};

export function resolveTrustedProfileClaims(jwtPayload: any) {
  const appMetadata = jwtPayload?.app_metadata || {}
  const role = appMetadata.kanvise_role || appMetadata.role
  const { school_id, kanvise_user_id, profile_id } = appMetadata

  if (!role || !kanvise_user_id || !profile_id) return null

  return {
    id: profile_id,
    supabase_auth_id: jwtPayload.sub,
    role,
    school_id: school_id || null,
    kanvise_user_id,
    email: jwtPayload.email || null,
  }
}

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
  
  // Fast path: only app_metadata is trusted for authorisation claims.
  // Supabase users can edit user_metadata themselves, so it must never decide
  // role, tenant, or profile identity.
  const trustedClaims = resolveTrustedProfileClaims(jwtPayload)

  if (trustedClaims) {
    c.set('user', trustedClaims)
    return await next()
  }
  
  // Slow path - lookup from DB
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, role, school_id, kanvise_user_id, first_name, last_name, email, is_active')
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

  if (profile.is_active === false) {
    return c.json({ error: 'This account has been deactivated', code: 'ACCOUNT_INACTIVE' }, 403)
  }
  
  c.set('user', {
    id: profile.id,
    supabase_auth_id: supabaseAuthId,
    role: profile.role,
    school_id: profile.school_id,
    kanvise_user_id: profile.kanvise_user_id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email || jwtPayload.email || null,
  })

  // Existing users may have been issued tokens before trusted claims moved to
  // app_metadata. Backfill from the canonical profile without blocking access
  // if the Auth admin update is temporarily unavailable. The new claims take
  // effect when Supabase next refreshes the user's token.
  try {
    await supabase.auth.admin.updateUserById(supabaseAuthId, {
      app_metadata: {
        ...(jwtPayload.app_metadata || {}),
        role: profile.role,
        kanvise_role: profile.role,
        school_id: profile.school_id,
        kanvise_user_id: profile.kanvise_user_id,
        profile_id: profile.id,
      },
    })
  } catch (metadataError) {
    console.error('[auth] Failed to backfill trusted profile claims:', metadataError)
  }
  
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

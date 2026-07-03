import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { supabase } from '../lib/supabase'

export const jwtVerificationMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorisation header', code: 'MISSING_AUTH' }, 401)
  }
  
  const token = authHeader.split(' ')[1]
  try {
    const secret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long'
    const payload = await verify(token, secret)
    c.set('jwt_payload', payload)
    await next()
  } catch (error: any) {
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
  const { kanvise_role, school_id, kanvise_user_id } = userMetadata
  
  if (kanvise_role && kanvise_user_id) {
    c.set('user', {
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

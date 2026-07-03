import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware } from '../middleware/auth'
import { validateInviteToken } from '../lib/invites'

export const authRouter = new Hono()

authRouter.use('*', jwtVerificationMiddleware)
authRouter.use('*', profileResolutionMiddleware)
authRouter.use('*', tenantMiddleware)

authRouter.post('/profile/init', async (c) => {
  const body = await c.req.json()
  const { role, first_name, last_name, invite_token } = body
  const user = c.get('user')
  const supabaseAuthId = user.supabase_auth_id

  let schoolId = null

  if (role === 'tutor') {
    if (!invite_token) return c.json({ error: 'Invite token required for tutors' }, 400)
    try {
      const payload = validateInviteToken(invite_token)
      schoolId = payload.school_id
    } catch (e: any) {
      return c.json({ error: e.message || 'Invalid invite token' }, 400)
    }
  }

  // Generate Kanvise User ID
  const { data: seqData, error: seqError } = await supabase.rpc('increment_user_sequence', { p_role: role })
  let number = '00001'
  if (!seqError && seqData) {
    number = seqData.toString().padStart(5, '0')
  } else if (seqError) {
    console.error("RPC Error:", seqError)
    // If RPC doesn't exist yet, fallback to timestamp based
    number = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  }
  
  const roleCode = { admin: 'ADM', tutor: 'TUT', student: 'STU' }[role as string]
  const kanviseUserId = `KNV-${roleCode}-${number}`

  const { data: profile, error } = await supabase.from('user_profiles').insert({
    supabase_auth_id: supabaseAuthId,
    role,
    school_id: schoolId,
    kanvise_user_id: kanviseUserId,
    first_name,
    last_name,
  }).select().single()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  // Update Supabase Auth user_metadata via Admin API
  await supabase.auth.admin.updateUserById(supabaseAuthId, {
    user_metadata: {
      kanvise_role: role,
      school_id: schoolId,
      kanvise_user_id: kanviseUserId,
      first_name,
      last_name
    }
  })

  return c.json({ profile })
})

authRouter.get('/me', async (c) => {
  const user = c.get('user')
  return c.json({ user })
})

authRouter.patch('/me', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  
  // Security: Cannot update role or school_id
  delete body.role
  delete body.school_id
  
  const { data, error } = await supabase.from('user_profiles')
    .update(body)
    .eq('id', user.id)
    .select()
    .single()
    
  if (error) return c.json({ error: error.message }, 500)
  
  return c.json({ user: data })
})

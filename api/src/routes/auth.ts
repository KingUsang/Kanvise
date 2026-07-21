import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, Variables } from '../middleware/auth'
import { validateInviteToken } from '../lib/invites'
import { ensureWelcomeEmail } from '../emails/ensure-welcome-email'

export const authRouter = new Hono<{ Variables: Variables }>()

async function deliverWelcome(profile: any, email: string) {
  try {
    const frontendUrl = process.env.FRONTEND_URL
    if (!frontendUrl) throw new Error('FRONTEND_URL is required for welcome email delivery')
    return await ensureWelcomeEmail({
      profileId: profile.id,
      recipientEmail: email,
      firstName: profile.first_name,
      dashboardUrl: `${frontendUrl.replace(/\/$/, '')}/dashboard`,
    })
  } catch (error) {
    console.error('[auth/profile/init] Welcome email failed:', error)
    return { sent: false, id: null, alreadySent: false }
  }
}

authRouter.use('*', jwtVerificationMiddleware)
authRouter.use('*', profileResolutionMiddleware)
authRouter.use('*', tenantMiddleware)

authRouter.post('/profile/init', async (c) => {
  const body = await c.req.json()
  const { role, first_name, last_name, invite_token } = body
  const user = c.get('user')
  const jwtPayload = c.get('jwt_payload')
  const supabaseAuthId = user.supabase_auth_id
  const email = jwtPayload.email

  if (!email) {
    return c.json({ error: 'Authenticated user has no email address' }, 400)
  }

  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('supabase_auth_id', supabaseAuthId)
    .maybeSingle()

  if (existingProfile) {
    const welcome = await deliverWelcome(existingProfile, email)
    return c.json({
      profile: existingProfile,
      created: false,
      welcome_email_sent: welcome.sent,
      welcome_email_id: welcome.id,
      welcome_email_already_sent: welcome.alreadySent,
    })
  }

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

  let { data: profile, error } = await supabase.from('user_profiles').insert({
    supabase_auth_id: supabaseAuthId,
    role,
    school_id: schoolId,
    kanvise_user_id: kanviseUserId,
    first_name,
    last_name,
    email,
  }).select().single()

  if (error) {
    // A concurrent callback may have created this same profile after our initial read.
    // Resolve that race as a successful idempotent replay.
    if (error.code === '23505') {
      const existing = await supabase.from('user_profiles')
        .select('*')
        .eq('supabase_auth_id', supabaseAuthId)
        .maybeSingle()
      if (existing.data) {
        const welcome = await deliverWelcome(existing.data, email)
        return c.json({
          profile: existing.data,
          created: false,
          welcome_email_sent: welcome.sent,
          welcome_email_id: welcome.id,
          welcome_email_already_sent: welcome.alreadySent,
        })
      }
    }
    return c.json({ error: error.message }, 500)
  }

  // Update Supabase Auth user_metadata via Admin API
  await supabase.auth.admin.updateUserById(supabaseAuthId, {
    user_metadata: {
      kanvise_role: role,
      school_id: schoolId,
      kanvise_user_id: kanviseUserId,
      profile_id: profile.id,
      first_name,
      last_name
    }
  })

  const welcome = await deliverWelcome(profile, email)

  return c.json({
    profile,
    created: true,
    welcome_email_sent: welcome.sent,
    welcome_email_id: welcome.id,
    welcome_email_already_sent: welcome.alreadySent,
  }, 201)
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

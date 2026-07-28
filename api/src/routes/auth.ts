import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, Variables } from '../middleware/auth'
import { validateInviteToken } from '../lib/invites'
import { ensureWelcomeEmail } from '../emails/ensure-welcome-email'
import type { TablesUpdate } from '../lib/database.types'

export const authRouter = new Hono<{ Variables: Variables }>()

async function deliverWelcome(profile: any, email: string) {
  try {
    const frontendUrl = process.env.FRONTEND_URL
    if (!frontendUrl) throw new Error('FRONTEND_URL is required for welcome email delivery')
    const base = frontendUrl.replace(/\/$/, '')
    const dashboardUrl = profile.role === 'student' ? `${base}/dashboard/student` : `${base}/dashboard`
    return await ensureWelcomeEmail({
      profileId: profile.id,
      recipientEmail: email,
      firstName: profile.first_name,
      dashboardUrl,
    })
  } catch (error) {
    console.error('[auth/profile/init] Welcome email failed:', error)
    return { sent: false, id: null, alreadySent: false }
  }
}

const ALLOWED_ROLES = ['admin', 'tutor', 'student'] as const

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

  if (!ALLOWED_ROLES.includes(role)) {
    return c.json({ error: 'Invalid role' }, 400)
  }

  if (!String(first_name || '').trim() || !String(last_name || '').trim()) {
    return c.json({ error: 'First name and last name are required' }, 400)
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
      if (String(payload.email).toLowerCase() !== String(email).toLowerCase()) {
        return c.json({ error: 'This invitation was sent to a different email address' }, 403)
      }
      const { data: claimed, error: claimError } = await supabase.rpc('consume_tutor_invite', {
        p_invite_id: payload.invite_id,
        p_email: email,
        p_supabase_auth_id: supabaseAuthId,
      })
      if (claimError || !claimed) {
        return c.json({ error: claimError?.message || 'This invitation is no longer valid' }, 400)
      }
      schoolId = claimed
      if (schoolId !== payload.school_id) {
        return c.json({ error: 'Invalid invitation' }, 400)
      }
    } catch (e: any) {
      return c.json({ error: e.message || 'Invalid invite token' }, 400)
    }
  }

  // Staging's deployed RPC accepts p_role and returns the next numeric value.
  // Retry a few times when the sequence is behind existing seeded profiles;
  // this lets the allocator catch up without making signup fail.
  const roleCode = { admin: 'ADM', tutor: 'TUT', student: 'STU' }[role as 'admin' | 'tutor' | 'student']
  let kanviseUserId = ''
  let profile: any = null
  let error: any = null

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data: seqData, error: seqError } = await supabase.rpc('increment_user_sequence', { p_role: role })
    if (seqError || seqData === null || seqData === undefined) {
      console.error('[auth/profile/init] Could not allocate user ID:', seqError)
      return c.json({ error: 'Account setup is temporarily unavailable. Please try again.' }, 503)
    }

    kanviseUserId = `KNV-${roleCode}-${String(seqData).padStart(5, '0')}`
    const insertResult = await supabase.from('user_profiles').insert({
      supabase_auth_id: supabaseAuthId,
      role,
      school_id: schoolId,
      kanvise_user_id: kanviseUserId,
      first_name,
      last_name,
      email,
    }).select().single()

    profile = insertResult.data
    error = insertResult.error
    if (!error || error.code !== '23505' || !String(error.message).includes('kanvise_user_id')) break
  }

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

  // Keep editable presentation data in user_metadata. Authorisation claims
  // belong in app_metadata, which cannot be changed by the signed-in user.
  await supabase.auth.admin.updateUserById(supabaseAuthId, {
    user_metadata: {
      first_name,
      last_name
    },
    app_metadata: {
      ...(jwtPayload.app_metadata || {}),
      role,
      kanvise_role: role,
      school_id: schoolId,
      kanvise_user_id: kanviseUserId,
      profile_id: profile.id
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

// A roster-imported student receives an Auth account only when their invitation
// is sent. Mark the already-existing roster profile active after they set their
// own password; this never creates a second profile or enrolment.
authRouter.post('/profile/activate', async (c) => {
  const user = c.get('user')
  if (user.role !== 'student' || !user.id) {
    return c.json({ error: 'Only student profiles can be activated', code: 'FORBIDDEN' }, 403)
  }

  const { error } = await supabase.from('user_profiles')
    .update({ onboarding_status: 'active', activated_at: new Date().toISOString() } as any)
    .eq('id', user.id)
    .eq('role', 'student')

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Student profile activated' })
})

authRouter.patch('/me', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const allowedFields = ['first_name', 'last_name', 'bio'] as const
  const updates = Object.fromEntries(
    allowedFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, typeof body[field] === 'string' ? body[field].trim() : body[field]])
  )

  if (!Object.keys(updates).length) {
    return c.json({ error: 'No editable profile fields were provided' }, 400)
  }
  
  const { data, error } = await supabase.from('user_profiles')
    .update(updates as TablesUpdate<'user_profiles'>)
    .eq('id', user.id)
    .select()
    .single()
    
  if (error) return c.json({ error: error.message }, 500)

  await supabase.auth.admin.updateUserById(user.supabase_auth_id, {
    user_metadata: {
      first_name: data.first_name,
      last_name: data.last_name,
    },
  })
  
  return c.json({ user: data })
})

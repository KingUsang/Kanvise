import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole, Variables } from '../middleware/auth'
import { generateInviteToken } from '../lib/invites'
import { sendTutorInvitation } from '../emails/send-tutor-invitation'
import { normalizeSchoolProfileUpdate, schoolSlugCandidates, SchoolProfileValidationError } from '../lib/school-profile'
import type { TablesUpdate } from '../lib/database.types'

export const schoolsRouter = new Hono<{ Variables: Variables }>()

schoolsRouter.use('*', jwtVerificationMiddleware)
schoolsRouter.use('*', profileResolutionMiddleware)
schoolsRouter.use('*', tenantMiddleware)

schoolsRouter.post('/', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const name = String(body.name || '').trim()

  // Check the canonical profile as well as the JWT claim. A browser can still
  // hold its pre-setup token immediately after the first centre is created.
  const { data: canonicalProfile, error: profileLookupError } = await supabase
    .from('user_profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (profileLookupError) {
    return c.json({ error: 'Could not verify your centre setup status' }, 500)
  }

  if (user.school_id || canonicalProfile?.school_id) {
    return c.json({
      error: 'A centre is already configured for this account',
      code: 'SCHOOL_ALREADY_CONFIGURED',
    }, 409)
  }

  if (!name) {
    return c.json({ error: 'Centre name is required', code: 'INVALID_NAME' }, 400)
  }

  const requestedSlug = body.slug === undefined || body.slug === null ? undefined : body.slug
  const slugCandidates = schoolSlugCandidates(name, requestedSlug)
  const slug = slugCandidates[0]

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return c.json({
      error: 'Portal URL must use lowercase letters, numbers, and single hyphens only',
      code: 'INVALID_SLUG',
    }, 400)
  }

  if (body.description !== undefined && String(body.description).length > 500) {
    return c.json({ error: 'Centre description cannot exceed 500 characters', code: 'DESCRIPTION_TOO_LONG' }, 400)
  }

  // Generated links should never turn a common centre name into onboarding
  // work. The unique database constraint remains the source of truth and makes
  // these retries safe even when two admins create similarly named centres at
  // the same time. A deliberately customised link still fails explicitly.
  let school: any = null
  let schoolError: any = null
  for (const candidate of slugCandidates) {
    const result = await supabase
      .from('schools')
      .insert({
        name,
        slug: candidate,
        description: body.description,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
      })
      .select()
      .single()

    school = result.data
    schoolError = result.error
    if (!schoolError || schoolError.code !== '23505' || requestedSlug !== undefined) break
  }

  if (schoolError) {
    if (schoolError.code === '23505') {
      return c.json({
        error: requestedSlug === undefined
          ? 'We could not generate an available student page link. Please try again.'
          : 'That student page link is already in use. Choose another one.',
        code: 'SLUG_TAKEN',
      }, 409)
    }
    return c.json({ error: schoolError.message }, 500)
  }

  // Link admin to school
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ school_id: school.id })
    .eq('id', user.id)

  if (profileError) {
    return c.json({ error: profileError.message }, 500)
  }

  // Update the trusted tenant claim used by the API fast path and RLS.
  const { data: userData } = await supabase.auth.admin.getUserById(user.supabase_auth_id)
  if (userData.user) {
    const currentMetadata = userData.user.app_metadata || {}
    const { error: metadataError } = await supabase.auth.admin.updateUserById(user.supabase_auth_id, {
      app_metadata: {
        ...currentMetadata,
        school_id: school.id
      }
    })
    if (metadataError) {
      console.error('[schools] School created but trusted tenant claim update failed:', metadataError)
      return c.json({
        error: 'Your centre was created, but your session could not be updated. Please sign in again.',
        code: 'SESSION_UPDATE_REQUIRED',
      }, 503)
    }
  }

  return c.json({ school })
})

schoolsRouter.get('/me', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const schoolId = user.school_id

  if (!schoolId) {
    return c.json({ error: 'User does not belong to a school' }, 400)
  }

  const { data: school, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single()

  if (error || !school) {
    return c.json({ error: 'School not found' }, 404)
  }

  return c.json({ data: school })
})

schoolsRouter.patch('/me', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const schoolId = user.school_id

  if (!schoolId) {
    return c.json({ error: 'User does not belong to a school' }, 400)
  }

  const body = await c.req.json()

  let updatePayload: Record<string, string | boolean | null>
  try {
    updatePayload = normalizeSchoolProfileUpdate(body)
  } catch (error) {
    if (error instanceof SchoolProfileValidationError) {
      return c.json({ error: error.message, code: 'INVALID_PROFILE_FIELD', field: error.field }, 400)
    }
    throw error
  }

  if (Object.keys(updatePayload).length === 0) {
    return c.json({ error: 'No profile changes were provided', code: 'NO_CHANGES' }, 400)
  }

  const { data: school, error } = await supabase
    .from('schools')
    .update(updatePayload as TablesUpdate<'schools'>)
    .eq('id', schoolId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({
        error: 'That student page link is already in use. Choose another one.',
        code: 'SLUG_TAKEN',
      }, 409)
    }
    return c.json({ error: error.message }, 500)
  }

  return c.json({ data: school })
})

// POST /schools/me/invite/tutor — Generate a signed tutor invite link
schoolsRouter.post('/me/invite/tutor', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { email } = body

  if (!email) {
    return c.json({ error: 'Email is required', code: 'BAD_REQUEST' }, 400)
  }

  // Duplicate-invite guard: block if a pending invite already exists for this email+school
  const { data: existing } = await supabase
    .from('tutor_invites')
    .select('id, email, expires_at')
    .eq('school_id', user.school_id)
    .eq('email', email.toLowerCase().trim())
    .eq('status', 'pending')
    .maybeSingle()

  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    return c.json({
      error: 'A pending invite already exists for this email. Revoke it first to generate a new link.',
      code: 'DUPLICATE_INVITE'
    }, 409)
  }
  if (existing) {
    await supabase
      .from('tutor_invites')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('school_id', user.school_id)
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Create the tutor_invites row
  const { data: invite, error: insertError } = await supabase
    .from('tutor_invites')
    .insert({
      school_id: user.school_id,
      email: email.toLowerCase().trim(),
      invited_by: user.id,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (insertError) {
    return c.json({ error: insertError.message }, 500)
  }

  // Bind the signed link to this exact database row and recipient. Revocation,
  // expiry and single-use status are therefore enforced during acceptance.
  const token = generateInviteToken(invite.id, user.school_id, invite.email)

  const appUrl = process.env.FRONTEND_URL!
  const inviteUrl = `${appUrl}/join?token=${token}`

  const { data: school } = await supabase
    .from('schools')
    .select('name')
    .eq('id', user.school_id)
    .single()

  const invitedByName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'A school administrator'
  let emailSent = false
  let emailId: string | null = null

  try {
    const delivery = await sendTutorInvitation({
      to: invite.email,
      inviteUrl,
      invitedByName,
      schoolName: school?.name || 'your school',
      expiresAt: invite.expires_at,
    })
    emailSent = true
    emailId = delivery.id
  } catch (error) {
    // The invite remains usable and can still be copied by the Admin.
    console.error('[schools/me/invite/tutor] Tutor invitation email failed:', error)
  }

  return c.json({
    data: {
      invite_url: inviteUrl,
      expires_at: invite.expires_at,
      email_sent: emailSent,
      email_id: emailId,
    },
    message: emailSent
      ? 'Invite created and emailed to the tutor.'
      : 'Invite created, but the email could not be sent. Share the link with your tutor.'
  }, 201)
})

// GET /schools/me/invites — List all invites for this school
schoolsRouter.get('/me/invites', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const status = c.req.query('status') // optional filter: pending | accepted | expired | revoked

  let query = supabase
    .from('tutor_invites')
    .select('id, email, status, expires_at, accepted_at, created_at')
    .eq('school_id', user.school_id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({
    data: (data || []).map((invite) => ({
      ...invite,
      status: invite.status === 'pending' && new Date(invite.expires_at).getTime() <= Date.now()
        ? 'expired'
        : invite.status,
    }))
  })
})

// POST /schools/me/invites/:id/revoke — Revoke a pending invite
schoolsRouter.post('/me/invites/:id/revoke', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!

  // Fetch the invite — must belong to this school and be pending
  const { data: invite, error: fetchError } = await supabase
    .from('tutor_invites')
    .select('id, status, school_id')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !invite) {
    return c.json({ error: 'Invite not found', code: 'NOT_FOUND' }, 404)
  }

  if (invite.status !== 'pending') {
    return c.json({
      error: `Cannot revoke an invite with status '${invite.status}'`,
      code: 'INVALID_STATUS'
    }, 400)
  }

  const { error: updateError } = await supabase
    .from('tutor_invites')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (updateError) {
    return c.json({ error: updateError.message }, 500)
  }

  return c.json({ message: 'Invite revoked successfully' })
})

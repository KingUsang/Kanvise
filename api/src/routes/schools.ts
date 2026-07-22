import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole, Variables } from '../middleware/auth'
import { generateInviteToken } from '../lib/invites'
import { sendTutorInvitation } from '../emails/send-tutor-invitation'

export const schoolsRouter = new Hono<{ Variables: Variables }>()

schoolsRouter.use('*', jwtVerificationMiddleware)
schoolsRouter.use('*', profileResolutionMiddleware)
schoolsRouter.use('*', tenantMiddleware)

schoolsRouter.post('/', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  // Ensure they don't already have a school configured
  if (user.school_id) {
    return c.json({ error: 'School is already configured for this account' }, 400)
  }

  // Generate a basic slug if one isn't provided (for MVP)
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  // Create school
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .insert({
      name: body.name,
      slug: slug,
      description: body.description,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
    })
    .select()
    .single()

  if (schoolError) {
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
    await supabase.auth.admin.updateUserById(user.supabase_auth_id, {
      app_metadata: {
        ...currentMetadata,
        school_id: school.id
      }
    })
  }

  return c.json({ school })
})

schoolsRouter.get('/mine', requireRole('admin'), async (c) => {
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

schoolsRouter.patch('/mine', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const schoolId = user.school_id

  if (!schoolId) {
    return c.json({ error: 'User does not belong to a school' }, 400)
  }

  const body = await c.req.json()

  if (body.name !== undefined && !String(body.name).trim()) {
    return c.json({ error: 'Institution name is required', code: 'INVALID_NAME' }, 400)
  }
  if (body.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(body.slug))) {
    return c.json({ error: 'Portal URL must use lowercase letters, numbers, and single hyphens only', code: 'INVALID_SLUG' }, 400)
  }
  if (body.description !== undefined && String(body.description).length > 500) {
    return c.json({ error: 'Institution description cannot exceed 500 characters', code: 'DESCRIPTION_TOO_LONG' }, 400)
  }

  // Prepare update payload according to Api spec.md
  const updatePayload: any = {}
  
  if (body.name !== undefined) updatePayload.name = body.name
  if (body.slug !== undefined) updatePayload.slug = body.slug
  if (body.description !== undefined) updatePayload.description = body.description
  if (body.contact_email !== undefined) updatePayload.contact_email = body.contact_email
  if (body.contact_phone !== undefined) updatePayload.contact_phone = body.contact_phone
  if (body.website_url !== undefined) updatePayload.website_url = body.website_url
  if (body.instagram_url !== undefined) updatePayload.instagram_url = body.instagram_url
  if (body.twitter_url !== undefined) updatePayload.twitter_url = body.twitter_url
  if (body.facebook_url !== undefined) updatePayload.facebook_url = body.facebook_url
  if (body.whatsapp_number !== undefined) updatePayload.whatsapp_number = body.whatsapp_number
  if (body.is_active !== undefined) updatePayload.is_active = body.is_active
  // Note: Skipping logo_key, banner_key, video_intro_key for now as requested by user

  const { data: school, error } = await supabase
    .from('schools')
    .update(updatePayload)
    .eq('id', schoolId)
    .select()
    .single()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ data: school })
})

// POST /schools/invites — Generate a signed tutor invite link
schoolsRouter.post('/invites', requireRole('admin'), async (c) => {
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

  if (existing) {
    return c.json({
      error: 'A pending invite already exists for this email. Revoke it first to generate a new link.',
      code: 'DUPLICATE_INVITE'
    }, 409)
  }

  // Generate the HMAC-SHA256 signed token
  const token = generateInviteToken(user.school_id, user.id)
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
    console.error('[schools/invites] Tutor invitation email failed:', error)
  }

  // TODO(ux): The stateless HMAC token makes the URL very long (~150+ chars).
  // If this becomes a UX issue for sharing via SMS/WhatsApp, we should switch to a
  // Stateful Short Token architecture:
  // 1. Generate a random 16-char string (e.g. nanoid)
  // 2. Add a `token` column to the `tutor_invites` table and save it there
  // 3. Update the frontend/backend to do a DB lookup `WHERE token = ?` to validate.
  //
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

// GET /schools/invites — List all invites for this school
schoolsRouter.get('/invites', requireRole('admin'), async (c) => {
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

  return c.json({ data })
})

// POST /schools/invites/:id/revoke — Revoke a pending invite
schoolsRouter.post('/invites/:id/revoke', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

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

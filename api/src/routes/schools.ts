import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, Variables } from '../middleware/auth'
import { accountUserProjection } from '../middleware/account-projection'
import { sendTutorInvitation } from '../emails/send-tutor-invitation'
import { createAccountInvitation } from '../lib/account-invitations'
import { isReservedSchoolSlug, normalizeSchoolProfileUpdate, schoolSlugCandidates, SchoolProfileValidationError } from '../lib/school-profile'
import type { TablesUpdate } from '../lib/database.types'

export const schoolsRouter = new Hono<{ Variables: Variables }>()

schoolsRouter.use('*', jwtVerificationMiddleware)
schoolsRouter.use('*', profileResolutionMiddleware)
// Creating the first account happens before any membership exists, so POST /
// stays on the profile-only sequence. Every /me route acts on the selected
// active account (DEV-SEC-004).
schoolsRouter.use('/me/*', accountContextMiddleware, accountUserProjection)

const createSchoolSchema = z.object({
  name: z.string().trim().max(120).default(''),
  account_type: z.string().max(32).nullish(),
  slug: z.string().max(63).nullish(),
  description: z.string().max(500).nullish(),
  contact_email: z.string().trim().email().max(254).nullish(),
  contact_phone: z.string().trim().max(32).nullish(),
})

schoolsRouter.post('/', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const parsed = createSchoolSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    if (field === 'description') return c.json({ error: 'Centre description cannot exceed 500 characters', code: 'DESCRIPTION_TOO_LONG' }, 400)
    if (field === 'slug') return c.json({ error: 'Portal URL must use lowercase letters, numbers, and single hyphens only', code: 'INVALID_SLUG' }, 400)
    return c.json({ error: 'Check the account details and try again', code: field === 'name' ? 'INVALID_NAME' : 'VALIDATION_ERROR' }, 400)
  }
  const body = parsed.data
  const name = body.name
  const accountType = body.account_type === 'independent' ? 'independent' : 'centre'

  // A browser can still hold its pre-setup token right after the first
  // account is created. The database function re-checks the canonical profile
  // under a row lock, so concurrent requests cannot create two accounts.
  if (user.school_id) {
    return c.json({
      error: 'A centre is already configured for this account',
      code: 'SCHOOL_ALREADY_CONFIGURED',
    }, 409)
  }

  if (!name) {
    return c.json({ error: accountType === 'independent' ? 'Tutor name is required' : 'Centre name is required', code: 'INVALID_NAME' }, 400)
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

  if (requestedSlug !== undefined && isReservedSchoolSlug(slug)) {
    return c.json({
      error: 'That student page link is reserved by Kanvise. Choose another one.',
      code: 'RESERVED_SLUG',
    }, 400)
  }

  // Generated links should never turn a common centre name into onboarding
  // work. The unique database constraint remains the source of truth and makes
  // these retries safe: a rejected insert rolls the whole function back. A
  // deliberately customised link still fails explicitly.
  let school: any = null
  let alreadyConfigured = false
  let schoolError: any = null
  for (const candidate of slugCandidates) {
    const result = await (supabase as any).rpc('create_school_for_admin', {
      p_admin_id: user.id,
      p_name: name,
      p_account_type: accountType,
      p_slug: candidate,
      p_description: body.description ?? null,
      p_contact_email: body.contact_email ?? null,
      p_contact_phone: body.contact_phone ?? null,
    })
    schoolError = result.error
    school = result.data?.school ?? null
    alreadyConfigured = result.data?.already_configured === true
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
    console.error('[schools] Account creation failed', { code: schoolError.code })
    return c.json({ error: 'We could not create your tutoring agency right now. Please try again.', code: 'SCHOOL_CREATE_UNAVAILABLE' }, 503)
  }

  if (alreadyConfigured || !school) {
    return c.json({
      error: 'A centre is already configured for this account',
      code: 'SCHOOL_ALREADY_CONFIGURED',
    }, 409)
  }

  // Update the app_metadata school claim kept for web redirect hints and legacy
  // RLS. The API does not use it for authorization. The account and profile link
  // are already committed, so a failure here is a recoverable session refresh.
  const sessionUpdateRequired = () => c.json({
    error: 'Your tutoring agency was created, but your session could not be updated. Please sign in again.',
    code: 'SESSION_UPDATE_REQUIRED',
  }, 503)
  const { data: userData, error: userLookupError } = await supabase.auth.admin.getUserById(user.supabase_auth_id)
  if (userLookupError || !userData?.user) {
    console.error('[schools] School created but the Auth user could not be loaded:', { message: userLookupError?.message })
    return sessionUpdateRequired()
  }
  const { error: metadataError } = await supabase.auth.admin.updateUserById(user.supabase_auth_id, {
    app_metadata: {
      ...(userData.user.app_metadata || {}),
      school_id: school.id,
    },
  })
  if (metadataError) {
    console.error('[schools] School created but trusted tenant claim update failed:', metadataError)
    return sessionUpdateRequired()
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
    console.error('[schools] update failed', { code: error.code, message: error.message })
    return c.json({ error: 'Could not save the page settings', code: 'DATABASE_ERROR' }, 500)
  }

  return c.json({ data: school })
})

const tutorInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
})
const inviteListQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'expired', 'revoked']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})
const inviteIdSchema = z.string().uuid()

// POST /schools/me/invite/tutor: create a durable account invitation (/invite link) for a tutor. The tutor_invites row is kept only for the admin invite list and revoke; both records are written, and any earlier pending pair is revoked, in one database transaction.
schoolsRouter.post('/me/invite/tutor', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const parsed = tutorInviteSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Enter a valid email address', code: 'BAD_REQUEST' }, 400)
  }
  const { email } = parsed.data

  const appUrl = process.env.FRONTEND_URL
  if (!appUrl) return c.json({ error: 'Invitations are temporarily unavailable', code: 'INVITATIONS_UNAVAILABLE' }, 503)

  let durable: Awaited<ReturnType<typeof createAccountInvitation>>
  try {
    durable = await createAccountInvitation({
      schoolId: user.school_id,
      invitedBy: user.id,
      role: 'tutor',
      email,
    })
  } catch (error) {
    console.error('[schools/me/invite/tutor] Invitation could not be created:', { message: error instanceof Error ? error.message : 'unknown' })
    return c.json({ error: 'Could not create the invitation right now. Try again shortly.', code: 'INVITATION_UNAVAILABLE', retryable: true }, 503)
  }
  const inviteUrl = `${appUrl.replace(/\/$/, '')}/invite?token=${encodeURIComponent(durable.token)}`

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
      to: email,
      inviteUrl,
      invitedByName,
      schoolName: school?.name || 'your school',
      expiresAt: durable.expiresAt,
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
      expires_at: durable.expiresAt,
      email_sent: emailSent,
      email_id: emailId,
    },
    message: emailSent
      ? 'Invite created and emailed to the tutor.'
      : 'Invite created, but the email could not be sent. Share the link with your tutor.'
  }, 201)
})

// GET /schools/me/invites: bounded, paginated invitation history for this account.
schoolsRouter.get('/me/invites', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const parsed = inviteListQuerySchema.safeParse({
    status: c.req.query('status') || undefined,
    limit: c.req.query('limit') || undefined,
    offset: c.req.query('offset') || undefined,
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid invitation filter', code: 'VALIDATION_ERROR' }, 400)
  }
  const { status, limit, offset } = parsed.data
  const nowIso = new Date().toISOString()

  let query = supabase
    .from('tutor_invites')
    .select('id, email, status, expires_at, accepted_at, created_at')
    .eq('school_id', user.school_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit)

  // A pending row past its expiry is reported (and filtered) as expired.
  if (status === 'pending') query = query.eq('status', 'pending').gt('expires_at', nowIso)
  else if (status === 'expired') query = query.or(`status.eq.expired,and(status.eq.pending,expires_at.lte.${nowIso})`)
  else if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    console.error('[schools/me/invites] List failed', { code: error.code })
    return c.json({ error: 'Could not load invitations right now', code: 'INVITES_UNAVAILABLE' }, 503)
  }

  const rows = data || []
  return c.json({
    data: rows.slice(0, limit).map((invite) => ({
      ...invite,
      status: invite.status === 'pending' && new Date(invite.expires_at).getTime() <= Date.now()
        ? 'expired'
        : invite.status,
    })),
    pagination: { limit, offset, has_more: rows.length > limit },
  })
})

// POST /schools/me/invites/:id/revoke: revoke a pending invite and its durable link atomically.
schoolsRouter.post('/me/invites/:id/revoke', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = inviteIdSchema.safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Invite not found', code: 'NOT_FOUND' }, 404)

  const { data, error } = await (supabase as any).rpc('revoke_tutor_invitation', {
    p_school_id: user.school_id,
    p_tutor_invite_id: id.data,
  })
  if (error || !data) {
    console.error('[schools/me/invites/revoke] Revoke failed', { code: error?.code })
    return c.json({ error: 'Could not revoke the invitation right now. Try again shortly.', code: 'INVITE_REVOKE_UNAVAILABLE', retryable: true }, 503)
  }
  if (!data.found) {
    return c.json({ error: 'Invite not found', code: 'NOT_FOUND' }, 404)
  }
  if (!data.revoked) {
    return c.json({
      error: `Cannot revoke an invite with status '${data.status}'`,
      code: 'INVALID_STATUS'
    }, 400)
  }

  return c.json({ message: 'Invite revoked successfully' })
})

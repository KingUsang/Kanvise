import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole } from '../middleware/auth'

export const schoolsRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>()

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
      address: body.address,
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

  // Update Supabase Auth metadata
  const { data: userData } = await supabase.auth.admin.getUserById(user.supabase_auth_id)
  if (userData.user) {
    const currentMetadata = userData.user.user_metadata || {}
    await supabase.auth.admin.updateUserById(user.supabase_auth_id, {
      user_metadata: {
        ...currentMetadata,
        school_id: school.id
      }
    })
  }

  return c.json({ school })
})

// ---------------------------------------------------------------------------
// 2. GET /me - Get Admin's School Profile & Settings
// ---------------------------------------------------------------------------
schoolsRouter.get('/me', async (c) => {
  const user = c.get('user')
  if (!user.school_id) {
    return c.json({ error: 'No tutorial centre associated with this account', code: 'NO_SCHOOL' }, 404)
  }

  const { data: school, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', user.school_id)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: school }, 200)
})

// ---------------------------------------------------------------------------
// 3. PATCH /me - Update School Branding & Profile Settings
// ---------------------------------------------------------------------------
schoolsRouter.patch('/me', requireRole('admin'), async (c) => {
  const user = c.get('user')
  if (!user.school_id) {
    return c.json({ error: 'No tutorial centre associated with this account', code: 'NO_SCHOOL' }, 404)
  }

  const body = await c.req.json()
  const allowedFields = [
    'name', 'description', 'address', 'contact_email', 'contact_phone',
    'website_url', 'instagram_url', 'twitter_url', 'facebook_url',
    'whatsapp_number', 'logo_key', 'banner_key', 'video_intro_key'
  ]

  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  const { data: school, error } = await supabase
    .from('schools')
    .update(updates)
    .eq('id', user.school_id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: school }, 200)
})

// ---------------------------------------------------------------------------
// 4. DELETE /me/video-intro - Remove Video Intro from Profile
// ---------------------------------------------------------------------------
schoolsRouter.delete('/me/video-intro', requireRole('admin'), async (c) => {
  const user = c.get('user')
  if (!user.school_id) {
    return c.json({ error: 'No tutorial centre associated with this account', code: 'NO_SCHOOL' }, 404)
  }

  const { error } = await supabase
    .from('schools')
    .update({ video_intro_key: null })
    .eq('id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Video intro removed successfully' }, 200)
})

// ---------------------------------------------------------------------------
// 5. POST /me/invite/tutor - Generate Signed Tutor Invite Link
// ---------------------------------------------------------------------------
schoolsRouter.post('/me/invite/tutor', requireRole('admin'), async (c) => {
  const user = c.get('user')
  if (!user.school_id) {
    return c.json({ error: 'No tutorial centre associated with this account', code: 'NO_SCHOOL' }, 404)
  }

  const body = await c.req.json()
  const { email } = body

  // Generate a short-lived token linking to school_id
  const token = Buffer.from(JSON.stringify({
    school_id: user.school_id,
    email: email || null,
    expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  })).toString('base64url')

  const inviteUrl = `https://kanvise.ng/join?token=${token}`

  return c.json({
    data: {
      invite_url: inviteUrl,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  }, 201)
})

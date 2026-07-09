import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole } from '../middleware/auth'

export const schoolsRouter = new Hono()

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

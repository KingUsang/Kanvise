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

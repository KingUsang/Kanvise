import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, Variables } from '../middleware/auth'

export const avatarsRouter = new Hono<{ Variables: Variables }>()

avatarsRouter.use('*', jwtVerificationMiddleware)
avatarsRouter.use('*', profileResolutionMiddleware)

avatarsRouter.get('/me', async (c) => {
  const user = c.get('user')

  const { data, error } = await supabase
    .from('avatar_configs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return c.json({ error: error.message }, 500)
  }

  // If no avatar config exists yet, return empty or default
  return c.json({ avatar: data || null })
})

avatarsRouter.put('/me', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  // Ensure security overrides
  const configToSave = {
    ...body,
    user_id: user.id,
    school_id: user.school_id, // ensure it belongs to the correct school
  }

  // Upsert the avatar config
  const { data, error } = await supabase
    .from('avatar_configs')
    .upsert(configToSave, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ avatar: data })
})

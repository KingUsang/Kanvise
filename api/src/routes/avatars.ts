import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  Variables,
} from '../middleware/auth'
import type { AccountContext } from '../types'

export const avatarsRouter = new Hono<{ Variables: Variables }>()

avatarsRouter.use('*', jwtVerificationMiddleware)
avatarsRouter.use('*', profileResolutionMiddleware)
avatarsRouter.use('*', accountContextMiddleware)
avatarsRouter.use('*', async (c, next) => {
  const account = c.get('account') as AccountContext | undefined
  if (!account) return c.json({ error: 'Tutoring account context is required', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  const user = c.get('user')
  c.set('user', {
    ...user,
    school_id: account.id,
    role: account.role === 'learner' ? 'student' : account.role,
  })
  await next()
})

avatarsRouter.get('/me', async (c) => {
  const user = c.get('user')

  const { data, error } = await supabase
    .from('avatar_configs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('GET /avatars/me error:', error)
    return c.json({ error: 'Could not load avatar configuration', code: 'AVATAR_LOAD_FAILED' }, 500)
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
    console.error('PUT /avatars/me error:', error)
    return c.json({ error: 'Could not save avatar configuration', code: 'AVATAR_SAVE_FAILED' }, 500)
  }

  return c.json({ avatar: data })
})

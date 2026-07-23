import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import { publicFileUrl } from '../storage/r2'
import { validateStudentProfileUpdate } from '../domain/student-settings'
import type { AppVariables } from '../types'

export const studentSettingsRouter = new Hono<{ Variables: AppVariables }>()
studentSettingsRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)
studentSettingsRouter.use('/*', requireRole('student'))

studentSettingsRouter.get('/students/me/settings', async c => {
  const user = c.get('user')
  const [{ data: profile, error }, { data: school, error: schoolError }] = await Promise.all([
    supabase.from('user_profiles').select('id, kanvise_user_id, first_name, last_name, email, bio, profile_photo_key')
      .eq('id', user.id).eq('school_id', user.school_id).eq('role', 'student').maybeSingle(),
    supabase.from('schools').select('id, name').eq('id', user.school_id).maybeSingle(),
  ])
  if (error || schoolError) return c.json({ error: 'Could not load your settings', code: 'SETTINGS_LOAD_FAILED' }, 500)
  if (!profile) return c.json({ error: 'Student profile not found', code: 'NOT_FOUND' }, 404)
  const { profile_photo_key, ...safeProfile } = profile
  return c.json({ data: {
    profile: { ...safeProfile, profile_photo_url: profile_photo_key ? publicFileUrl(profile_photo_key) : null },
    school,
  } })
})

studentSettingsRouter.patch('/students/me/settings', async c => {
  const user = c.get('user')
  const body = await c.req.json()
  const { errors, updates } = validateStudentProfileUpdate(body)
  if (errors.length) return c.json({ error: 'Check your profile details', code: 'VALIDATION_ERROR', details: errors }, 400)
  if (!Object.keys(updates).length) return c.json({ error: 'No supported changes provided', code: 'NO_CHANGES' }, 400)
  const { data, error } = await supabase.from('user_profiles').update(updates)
    .eq('id', user.id).eq('school_id', user.school_id).eq('role', 'student')
    .select('id, kanvise_user_id, first_name, last_name, email, bio, profile_photo_key').maybeSingle()
  if (error) return c.json({ error: 'Could not update your profile', code: 'SETTINGS_UPDATE_FAILED' }, 500)
  if (!data) return c.json({ error: 'Student profile not found', code: 'NOT_FOUND' }, 404)
  const { profile_photo_key, ...safeProfile } = data
  return c.json({ data: { ...safeProfile, profile_photo_url: profile_photo_key ? publicFileUrl(profile_photo_key) : null } })
})

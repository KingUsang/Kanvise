import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

export const studentMembershipsRouter = new Hono<{ Variables: AppVariables }>()
const db = supabase as any

studentMembershipsRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'))

studentMembershipsRouter.get('/students/me/centres', async c => {
  const user = c.get('user')
  const { data, error } = await db.from('student_centre_memberships')
    .select('id, school_id, joined_at, school:schools(id, name)').eq('student_id', user.id).eq('status', 'active').order('joined_at')
  if (error) return c.json({ error: 'Could not load your centres' }, 500)
  return c.json({ data: (data || []).map((membership: any) => ({ ...membership, active: membership.school_id === user.school_id })) })
})

studentMembershipsRouter.post('/students/me/centres/:schoolId/select', async c => {
  const user = c.get('user'); const schoolId = c.req.param('schoolId')!
  const { data: membership, error } = await db.from('student_centre_memberships').select('id').eq('student_id', user.id).eq('school_id', schoolId).eq('status', 'active').maybeSingle()
  if (error || !membership) return c.json({ error: 'You are not an active student of this centre' }, 403)
  const { error: updateError } = await supabase.from('user_profiles').update({ school_id: schoolId, updated_at: new Date().toISOString() }).eq('id', user.id)
  if (updateError) return c.json({ error: 'Could not select this centre' }, 500)
  const { data: profile } = await supabase.from('user_profiles').select('supabase_auth_id').eq('id', user.id).maybeSingle()
  if (profile?.supabase_auth_id) {
    const { error: authError } = await supabase.auth.admin.updateUserById(profile.supabase_auth_id, { app_metadata: { school_id: schoolId } })
    if (authError) return c.json({ error: 'Centre selected, but refresh your session before continuing' }, 503)
  }
  return c.json({ data: { school_id: schoolId } })
})

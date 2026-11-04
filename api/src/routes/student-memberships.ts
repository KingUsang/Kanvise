import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

export const studentMembershipsRouter = new Hono<{ Variables: AppVariables }>()
const db = supabase as any
// GET /centres pagination defaults to 20 memberships and never exceeds 100.
const DEFAULT_MEMBERSHIP_PAGE_SIZE = 20
const MAX_MEMBERSHIP_PAGE_SIZE = 100
const CURSOR_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const CURSOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

type MembershipCursor = { joined_at: string; id: string }

function encodeMembershipCursor(cursor: MembershipCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeMembershipCursor(raw: string): MembershipCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<MembershipCursor>
    if (typeof parsed.joined_at !== 'string' || typeof parsed.id !== 'string') return null
    if (!CURSOR_TIMESTAMP_PATTERN.test(parsed.joined_at) || Number.isNaN(Date.parse(parsed.joined_at))) return null
    if (!CURSOR_ID_PATTERN.test(parsed.id)) return null
    return { joined_at: parsed.joined_at, id: parsed.id }
  } catch {
    return null
  }
}

studentMembershipsRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'))

studentMembershipsRouter.get('/centres', async c => {
  const user = c.get('user')
  const rawLimit = c.req.query('limit')
  const limit = rawLimit === undefined ? DEFAULT_MEMBERSHIP_PAGE_SIZE : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMBERSHIP_PAGE_SIZE) {
    return c.json({ error: `Limit must be an integer between 1 and ${MAX_MEMBERSHIP_PAGE_SIZE}`, code: 'VALIDATION_ERROR' }, 400)
  }

  const rawCursor = c.req.query('cursor')
  const cursor = rawCursor === undefined ? null : decodeMembershipCursor(rawCursor)
  if (rawCursor !== undefined && !cursor) {
    return c.json({ error: 'Cursor is invalid', code: 'VALIDATION_ERROR' }, 400)
  }

  let membershipsQuery = db.from('student_centre_memberships')
    .select('id, school_id, joined_at, school:schools(id, name)')
    .eq('student_id', user.id)
    .eq('status', 'active')
  if (cursor) {
    membershipsQuery = membershipsQuery.or(`joined_at.gt.${cursor.joined_at},and(joined_at.eq.${cursor.joined_at},id.gt.${cursor.id})`)
  }
  const { data, error } = await membershipsQuery.order('joined_at', { ascending: true }).order('id', { ascending: true }).limit(limit + 1)
  if (error) return c.json({ error: 'Could not load your centres', code: 'CENTRES_UNAVAILABLE' }, 500)

  const page = (data || []) as any[]
  const hasNext = page.length > limit
  const memberships = hasNext ? page.slice(0, limit) : page
  const nextCursor = hasNext ? encodeMembershipCursor({ joined_at: memberships[memberships.length - 1].joined_at, id: memberships[memberships.length - 1].id }) : null
  return c.json({
    data: memberships.map((membership: any) => ({ ...membership, active: membership.school_id === user.school_id })),
    meta: { limit, next_cursor: nextCursor },
  })
})

studentMembershipsRouter.post('/centres/:schoolId/select', async c => {
  const user = c.get('user'); const schoolId = c.req.param('schoolId')!
  const { data: membership, error } = await db.from('student_centre_memberships').select('id').eq('student_id', user.id).eq('school_id', schoolId).eq('status', 'active').maybeSingle()
  if (error) return c.json({ error: 'Could not verify this centre', code: 'CENTRE_SELECTION_UNAVAILABLE' }, 503)
  if (!membership) return c.json({ error: 'You are not an active student of this centre', code: 'FORBIDDEN' }, 403)
  const { data: school, error: schoolError } = await db.from('schools').select('id').eq('id', schoolId).eq('is_active', true).maybeSingle()
  if (schoolError) return c.json({ error: 'Could not verify this centre', code: 'CENTRE_SELECTION_UNAVAILABLE' }, 503)
  if (!school) return c.json({ error: 'You are not an active student of this centre', code: 'FORBIDDEN' }, 403)
  const { error: updateError } = await supabase.from('user_profiles').update({ school_id: schoolId, updated_at: new Date().toISOString() }).eq('id', user.id)
  if (updateError) return c.json({ error: 'Could not select this centre' }, 500)
  const { data: profile } = await supabase.from('user_profiles').select('supabase_auth_id').eq('id', user.id).maybeSingle()
  if (profile?.supabase_auth_id) {
    const { error: authError } = await supabase.auth.admin.updateUserById(profile.supabase_auth_id, { app_metadata: { school_id: schoolId } })
    if (authError) return c.json({ error: 'Centre selected, but refresh your session before continuing' }, 503)
  }
  return c.json({ data: { school_id: schoolId } })
})

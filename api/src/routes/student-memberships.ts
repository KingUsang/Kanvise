import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { ACCOUNT_CONTEXT_HEADER, jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'
import type { AppVariables } from '../types'

export const studentMembershipsRouter = new Hono<{ Variables: AppVariables }>()
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

studentMembershipsRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware)

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

  const selectedAccountId = c.req.header(ACCOUNT_CONTEXT_HEADER) || user.school_id
  let membershipsQuery = supabase.from('account_memberships')
    .select('id, school_id, joined_at, role, school:schools!inner(id, name)')
    .eq('person_id', user.id)
    .eq('status', 'active')
    .eq('school.is_active', true)
  if (cursor) {
    membershipsQuery = membershipsQuery.or(`joined_at.gt.${cursor.joined_at},and(joined_at.eq.${cursor.joined_at},id.gt.${cursor.id})`)
  }
  const { data, error } = await membershipsQuery.order('joined_at', { ascending: true }).order('id', { ascending: true }).limit(limit + 1)
  if (error) return c.json({ error: 'Could not load your centres', code: 'CENTRES_UNAVAILABLE' }, 500)

  const page = data || []
  const hasNext = page.length > limit
  const memberships = hasNext ? page.slice(0, limit) : page
  const nextCursor = hasNext ? encodeMembershipCursor({ joined_at: memberships[memberships.length - 1].joined_at, id: memberships[memberships.length - 1].id }) : null
  return c.json({
    data: memberships.map(membership => ({ ...membership, active: membership.school_id === selectedAccountId })),
    meta: { limit, next_cursor: nextCursor },
  })
})

studentMembershipsRouter.post('/centres/:schoolId/select', async c => {
  const user = c.get('user'); const schoolId = c.req.param('schoolId')!
  const { data: membership, error } = await supabase.from('account_memberships').select('id').eq('person_id', user.id).eq('school_id', schoolId).eq('status', 'active').maybeSingle()
  if (error) return c.json({ error: 'Could not verify this centre', code: 'CENTRE_SELECTION_UNAVAILABLE' }, 503)
  if (!membership) return c.json({ error: 'You are not an active member of this tutoring account', code: 'FORBIDDEN' }, 403)
  const { data: school, error: schoolError } = await supabase.from('schools').select('id').eq('id', schoolId).eq('is_active', true).maybeSingle()
  if (schoolError) return c.json({ error: 'Could not verify this centre', code: 'CENTRE_SELECTION_UNAVAILABLE' }, 503)
  if (!school) return c.json({ error: 'This tutoring account is unavailable', code: 'FORBIDDEN' }, 403)
  // Selection is a client preference. Protected requests must send the
  // selected account in X-Kanvise-Account-Id and resolve it again in Hono;
  // profile/Auth metadata are compatibility projections, never switch state.
  return c.json({ data: { school_id: schoolId } })
})

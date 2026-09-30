import { Hono } from 'hono'
import { createHash, randomBytes } from 'node:crypto'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import type { TenantVariables } from '../types'

export const directAssignmentsRouter = new Hono<{ Variables: TenantVariables }>()
export const publicDirectAssignmentsRouter = new Hono()

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const validToken = (value: string) => /^[A-Za-z0-9_-]{24,128}$/.test(value)

async function ownedAssignment(id: string, user: any) {
  if (!user.school_id) return null
  const { data } = await (supabase as any).from('direct_assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).eq('tutor_id', user.id).maybeSingle()
  return data as any
}

directAssignmentsRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

directAssignmentsRouter.get('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  let query = (supabase as any).from('direct_assignments')
    .select('*, direct_assignment_submissions(count)')
    .eq('school_id', user.school_id)
  if (user.role === 'tutor') query = query.eq('tutor_id', user.id)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: (data || []).map((item: any) => ({
    ...item,
    submission_count: item.direct_assignment_submissions?.[0]?.count || 0,
    direct_assignment_submissions: undefined,
    is_active: !item.revoked_at && new Date(item.expires_at).getTime() > Date.now(),
  })) })
})

directAssignmentsRouter.post('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null)
  const title = String(body?.title || '').trim()
  const description = String(body?.description || '').trim()
  const deadline = new Date(body?.deadline_at || '')
  if (!title || !description || !Number.isFinite(deadline.getTime()) || deadline.getTime() < Date.now() + 60 * 60 * 1000) {
    return c.json({ error: 'Title, instructions and a deadline at least one hour away are required', code: 'BAD_REQUEST' }, 400)
  }
  const rawToken = randomBytes(32).toString('base64url')
  const { data, error } = await (supabase as any).from('direct_assignments').insert({
    school_id: user.school_id,
    tutor_id: user.id,
    title,
    description,
    deadline_at: deadline.toISOString(),
    expires_at: deadline.toISOString(),
    share_token_hash: tokenHash(rawToken),
  }).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data, share_token: rawToken }, 201)
})

directAssignmentsRouter.post('/:id/revoke', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user'); const assignment = await ownedAssignment(c.req.param('id')!, user)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const { data, error } = await (supabase as any).from('direct_assignments').update({ revoked_at: new Date().toISOString() })
    .eq('id', assignment.id).eq('school_id', user.school_id).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

directAssignmentsRouter.get('/:id/submissions', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user'); const assignment = await ownedAssignment(c.req.param('id')!, user)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const { data, error } = await (supabase as any).from('direct_assignment_submissions').select('*')
    .eq('direct_assignment_id', assignment.id).eq('school_id', user.school_id).order('submitted_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: data || [] })
})

async function publicAssignment(token: string) {
  if (!validToken(token)) return null
  const { data } = await (supabase as any).from('direct_assignments').select('id, school_id, title, description, deadline_at, expires_at, revoked_at, school:schools(name, logo_url)')
    .eq('share_token_hash', tokenHash(token)).maybeSingle()
  if (!data || (data as any).revoked_at || new Date((data as any).expires_at).getTime() < Date.now()) return null
  return data as any
}

publicDirectAssignmentsRouter.get('/:token', async (c) => {
  const assignment = await publicAssignment(c.req.param('token')!)
  if (!assignment) return c.json({ error: 'This assignment link is unavailable', code: 'NOT_FOUND' }, 404)
  const school = Array.isArray(assignment.school) ? assignment.school[0] : assignment.school
  return c.json({ data: { id: assignment.id, title: assignment.title, description: assignment.description, deadline_at: assignment.deadline_at, tutor_name: school?.name || 'Your tutor', logo_url: school?.logo_url || null } })
})

publicDirectAssignmentsRouter.post('/:token/submit', async (c) => {
  const assignment = await publicAssignment(c.req.param('token')!)
  if (!assignment) return c.json({ error: 'This assignment link is unavailable', code: 'NOT_FOUND' }, 404)
  const body = await c.req.json().catch(() => null)
  const guestName = String(body?.guest_name || '').trim()
  const guestEmail = String(body?.guest_email || '').trim().toLowerCase()
  const responseText = String(body?.response_text || '').trim()
  if (guestName.length < 2 || guestName.length > 120 || !responseText || responseText.length > 20_000) {
    return c.json({ error: 'Enter your name and response', code: 'BAD_REQUEST' }, 400)
  }
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) return c.json({ error: 'Enter a valid email address', code: 'BAD_REQUEST' }, 400)
  const { data, error } = await (supabase as any).from('direct_assignment_submissions').insert({
    direct_assignment_id: assignment.id,
    school_id: (assignment as any).school_id,
    guest_name: guestName,
    guest_email: guestEmail || null,
    response_text: responseText,
  }).select('id, submitted_at').single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

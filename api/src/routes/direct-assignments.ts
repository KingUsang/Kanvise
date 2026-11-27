import { Hono } from 'hono'
import { createHash, randomBytes } from 'node:crypto'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, accountContextMiddleware } from '../middleware/auth'
import { accountUserProjection } from '../middleware/account-projection'
import type { TenantVariables } from '../types'
import { parseOffsetPagination } from '../lib/api-contract'
import { z } from 'zod'
import { clientAddress, createIpRateLimiter } from '../lib/ip-rate-limit'

export const directAssignmentsRouter = new Hono<{ Variables: TenantVariables }>()
export const publicDirectAssignmentsRouter = new Hono()

// Layered abuse controls for anonymous submissions (DEV-ASG-002): a per-address
// window (per process), a per-link cap and exact-duplicate replay.
const submitLimiter = createIpRateLimiter({ limit: 10, windowMs: 10 * 60_000 })
const MAX_SUBMISSIONS_PER_LINK = 500

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const validToken = (value: string) => /^[A-Za-z0-9_-]{24,128}$/.test(value)

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  deadline_at: z.string().trim().max(64).datetime({ offset: true }),
}).strict()

const publicSubmitSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().toLowerCase().max(254).email().optional().or(z.literal('')),
  response_text: z.string().trim().min(1).max(20_000),
}).strict()

function lookupUnavailable(c: any, detail: unknown) {
  console.error('direct_assignment.lookup_failed', detail instanceof Error ? detail.name : 'unknown')
  return c.json({ error: 'Could not load this assignment right now. Please try again.', code: 'DIRECT_ASSIGNMENT_LOOKUP_FAILED' }, 503)
}

function writeFailed(c: any, code: string, detail: unknown) {
  console.error(`direct_assignment.${code.toLowerCase()}`, detail instanceof Error ? detail.name : 'unknown')
  return c.json({ error: 'Could not complete this request right now', code }, 503)
}

// Distinguishes a failed lookup from a missing row (DEV-ASG-009).
async function ownedAssignment(id: string, user: any): Promise<{ row: any; error?: unknown }> {
  if (!user.school_id) return { row: null }
  const { data, error } = await (supabase as any).from('direct_assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).eq('tutor_id', user.id).maybeSingle()
  if (error) return { row: null, error }
  return { row: data as any }
}

directAssignmentsRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware, accountUserProjection)

directAssignmentsRouter.get('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const pagination = parseOffsetPagination(c.req.query('page'), c.req.query('page_size') ?? '100')
  if (!pagination) return c.json({ error: 'Invalid pagination', code: 'VALIDATION_ERROR' }, 400)
  let query = (supabase as any).from('direct_assignments')
    .select('*, direct_assignment_submissions(count)', { count: 'exact' })
    .eq('school_id', user.school_id)
  if (user.role === 'tutor') query = query.eq('tutor_id', user.id)
  const { data, error, count } = await query
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
  if (error) return lookupUnavailable(c, error)
  const items = (data || []).map((item: any) => ({
    ...item,
    submission_count: item.direct_assignment_submissions?.[0]?.count || 0,
    direct_assignment_submissions: undefined,
    is_active: !item.revoked_at && new Date(item.expires_at).getTime() > Date.now(),
  }))
  const total = count ?? items.length
  return c.json({
    data: items,
    pagination: { page: pagination.page, page_size: pagination.pageSize, total, has_more: pagination.offset + items.length < total },
  })
})

directAssignmentsRouter.post('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null))
  const deadline = new Date(parsed.success ? parsed.data.deadline_at : '')
  if (!parsed.success || !Number.isFinite(deadline.getTime()) || deadline.getTime() < Date.now() + 60 * 60 * 1000) {
    return c.json({ error: 'Title, instructions and a deadline at least one hour away are required', code: 'VALIDATION_ERROR' }, 400)
  }
  const { title, description } = parsed.data
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
  if (error) return writeFailed(c, 'DIRECT_ASSIGNMENT_CREATE_FAILED', error)
  return c.json({ data, share_token: rawToken }, 201)
})

directAssignmentsRouter.post('/:id/revoke', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user'); const owned = await ownedAssignment(c.req.param('id')!, user)
  if (owned.error) return lookupUnavailable(c, owned.error)
  const assignment = owned.row
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const { data, error } = await (supabase as any).from('direct_assignments').update({ revoked_at: new Date().toISOString() })
    .eq('id', assignment.id).eq('school_id', user.school_id).select().single()
  if (error) return writeFailed(c, 'DIRECT_ASSIGNMENT_REVOKE_FAILED', error)
  return c.json({ data })
})

directAssignmentsRouter.get('/:id/submissions', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user'); const owned = await ownedAssignment(c.req.param('id')!, user)
  if (owned.error) return lookupUnavailable(c, owned.error)
  const assignment = owned.row
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const pagination = parseOffsetPagination(c.req.query('page'), c.req.query('page_size') ?? '100')
  if (!pagination) return c.json({ error: 'Invalid pagination', code: 'VALIDATION_ERROR' }, 400)
  const { data, error, count } = await (supabase as any).from('direct_assignment_submissions').select('*', { count: 'exact' })
    .eq('direct_assignment_id', assignment.id).eq('school_id', user.school_id)
    .order('submitted_at', { ascending: false }).order('id', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
  if (error) return lookupUnavailable(c, error)
  const total = count ?? (data || []).length
  return c.json({
    data: data || [],
    pagination: { page: pagination.page, page_size: pagination.pageSize, total, has_more: pagination.offset + (data || []).length < total },
  })
})

// A share link stops accepting work at its deadline (DEV-ASG-010: expires_at equals deadline_at by design).
async function publicAssignment(token: string): Promise<{ row: any; error?: unknown }> {
  if (!validToken(token)) return { row: null }
  const { data, error } = await (supabase as any).from('direct_assignments').select('id, school_id, tutor_id, title, description, deadline_at, expires_at, revoked_at, school:schools(name, logo_url)')
    .eq('share_token_hash', tokenHash(token)).maybeSingle()
  if (error) return { row: null, error }
  if (!data || (data as any).revoked_at || new Date((data as any).expires_at).getTime() < Date.now()) return { row: null }
  return { row: data as any }
}

publicDirectAssignmentsRouter.get('/:token', async (c) => {
  const found = await publicAssignment(c.req.param('token')!)
  if (found.error) return lookupUnavailable(c, found.error)
  const assignment = found.row
  if (!assignment) return c.json({ error: 'This assignment link is unavailable', code: 'NOT_FOUND' }, 404)
  const school = Array.isArray(assignment.school) ? assignment.school[0] : assignment.school
  // The assigning Tutor and the account are distinct identities (DEV-ASG-006).
  const { data: tutor, error: tutorError } = await (supabase as any).from('user_profiles')
    .select('first_name, last_name').eq('id', assignment.tutor_id).maybeSingle()
  if (tutorError) return lookupUnavailable(c, tutorError)
  const tutorName = [tutor?.first_name, tutor?.last_name].filter(Boolean).join(' ').trim()
  return c.json({ data: {
    id: assignment.id, title: assignment.title, description: assignment.description, deadline_at: assignment.deadline_at,
    tutor_name: tutorName || 'Your tutor', account_name: school?.name || null, logo_url: school?.logo_url || null,
  } })
})

publicDirectAssignmentsRouter.post('/:token/submit', async (c) => {
  const retryAfter = submitLimiter.hit(clientAddress(c))
  if (retryAfter !== null) {
    c.header('Retry-After', String(retryAfter))
    return c.json({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' }, 429)
  }
  const found = await publicAssignment(c.req.param('token')!)
  if (found.error) return lookupUnavailable(c, found.error)
  const assignment = found.row
  if (!assignment) return c.json({ error: 'This assignment link is unavailable', code: 'NOT_FOUND' }, 404)
  const parsed = publicSubmitSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter your name, a valid email address if provided, and your response', code: 'VALIDATION_ERROR' }, 400)
  const { guest_name: guestName, guest_email: guestEmail, response_text: responseText } = parsed.data
  const submissions = (supabase as any).from('direct_assignment_submissions')
  const { count, error: countError } = await submissions.select('id', { count: 'exact', head: true })
    .eq('direct_assignment_id', assignment.id)
  if (countError) return lookupUnavailable(c, countError)
  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_LINK) {
    return c.json({ error: 'This assignment is no longer accepting responses', code: 'SUBMISSION_LIMIT_REACHED' }, 409)
  }
  // An exact repeat of the same response replays the stored result.
  const { data: existing, error: existingError } = await (supabase as any).from('direct_assignment_submissions')
    .select('id, submitted_at').eq('direct_assignment_id', assignment.id)
    .eq('guest_name', guestName).eq('response_text', responseText).limit(1).maybeSingle()
  if (existingError) return lookupUnavailable(c, existingError)
  if (existing) return c.json({ data: existing }, 200)
  const { data, error } = await (supabase as any).from('direct_assignment_submissions').insert({
    direct_assignment_id: assignment.id,
    school_id: (assignment as any).school_id,
    guest_name: guestName,
    guest_email: guestEmail || null,
    response_text: responseText,
  }).select('id, submitted_at').single()
  if (error) return writeFailed(c, 'DIRECT_SUBMISSION_FAILED', error)
  return c.json({ data }, 201)
})

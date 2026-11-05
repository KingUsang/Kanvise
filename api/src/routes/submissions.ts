import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware, requireMembershipRole } from '../middleware/auth'
import { notifySubmissionGraded } from '../notifications/triggers'
import type { AccountContext, TenantVariables } from '../types'

export const submissionsRouter = new Hono<{ Variables: TenantVariables }>()

const accountUserProjection = async (c: any, next: any) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext | undefined
  if (!account) return c.json({ error: 'Tutoring account context is required', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  c.set('user', {
    ...user,
    school_id: account.id,
    role: account.role === 'learner' ? 'student' : account.role,
  })
  await next()
}

submissionsRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware, accountUserProjection)

submissionsRouter.patch('/:id/review', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const { score, feedback } = await c.req.json()

  if (score === undefined || score === null || !Number.isFinite(Number(score))) {
    return c.json({ error: 'A numeric score is required', code: 'INVALID_SCORE' }, 400)
  }

  const { data: submission, error: fetchError } = await supabase.from('submissions')
    .select('*, assignment:assignments(id, title, tutor_id)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('submission.review_lookup_failed', fetchError instanceof Error ? fetchError.name : 'unknown')
    return c.json({ error: 'Could not load this submission right now', code: 'SUBMISSION_LOOKUP_FAILED' }, 503)
  }
  if (!submission) return c.json({ error: 'Submission not found', code: 'NOT_FOUND' }, 404)
  if (user.role === 'tutor' && (submission.assignment as any)?.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this assignment', code: 'FORBIDDEN' }, 403)
  }

  const { data, error } = await supabase.from('submissions').update({
    score: Number(score),
    feedback: feedback || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq('id', id).eq('school_id', user.school_id).select().single()

  if (error || !data) {
    console.error('submission.review_update_failed', error instanceof Error ? error.name : 'unknown')
    return c.json({ error: 'Could not save this review right now', code: 'SUBMISSION_REVIEW_FAILED' }, 503)
  }

  const assignment = submission.assignment as any
  const notification = await notifySubmissionGraded({
    id: data.id,
    schoolId: data.school_id,
    studentId: data.student_id,
    assignmentId: data.assignment_id,
    assignmentTitle: assignment?.title || 'Assignment',
    score: String(data.score),
    feedback: data.feedback,
  })

  return c.json({ data, notification })
})

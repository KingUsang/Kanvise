import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware, requireMembershipRole } from '../middleware/auth'
import { notifySubmissionGraded } from '../notifications/triggers'
import type { AccountContext, TenantVariables } from '../types'
import { tutorCanManageCourse } from '../lib/course-management-access'
import { z } from 'zod'

// Grading contract: score is a finite number from 0 to 100 inclusive (stored as
// NUMERIC(5,2), so it is rounded to two decimals); feedback is at most 5000 characters.
export const MAX_SCORE = 100
export const MAX_FEEDBACK_LENGTH = 5000
export const reviewSchema = z.object({
  score: z.number().finite().min(0).max(MAX_SCORE),
  feedback: z.string().trim().max(MAX_FEEDBACK_LENGTH).nullable().optional(),
}).strict()

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
  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Score must be a number from 0 to 100 and feedback at most 5000 characters', code: 'VALIDATION_ERROR' }, 400)
  const { score, feedback } = parsed.data

  const { data: submission, error: fetchError } = await supabase.from('submissions')
    .select('*, assignment:assignments(id, title, tutor_id, course_id)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('submission.review_lookup_failed', fetchError instanceof Error ? fetchError.name : 'unknown')
    return c.json({ error: 'Could not load this submission right now', code: 'SUBMISSION_LOOKUP_FAILED' }, 503)
  }
  if (!submission) return c.json({ error: 'Submission not found', code: 'NOT_FOUND' }, 404)
  // Same rule as listing submissions: a Tutor assigned to the Course, or an Admin.
  const courseId = (submission.assignment as any)?.course_id as string | undefined
  if (!courseId) return c.json({ error: 'Submission not found', code: 'NOT_FOUND' }, 404)
  const access = await tutorCanManageCourse(user, courseId)
  if (access.error) {
    console.error('submission.review_access_failed', access.error instanceof Error ? access.error.name : 'unknown')
    return c.json({ error: 'Could not verify review access right now', code: 'SUBMISSION_ACCESS_FAILED' }, 503)
  }
  if (!access.allowed) return c.json({ error: 'You cannot review this submission', code: 'FORBIDDEN' }, 403)

  const { data, error } = await supabase.from('submissions').update({
    score: Math.round(score * 100) / 100,
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

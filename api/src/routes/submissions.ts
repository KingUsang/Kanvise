import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import { notifySubmissionGraded } from '../notifications/triggers'
import type { TenantVariables } from '../types'

export const submissionsRouter = new Hono<{ Variables: TenantVariables }>()

submissionsRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

submissionsRouter.patch('/:id/review', requireRole('tutor', 'admin'), async (c) => {
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

  if (fetchError || !submission) return c.json({ error: 'Submission not found', code: 'NOT_FOUND' }, 404)
  if (user.role === 'tutor' && (submission.assignment as any)?.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this assignment', code: 'FORBIDDEN' }, 403)
  }

  const { data, error } = await supabase.from('submissions').update({
    score: Number(score),
    feedback: feedback || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq('id', id).eq('school_id', user.school_id).select().single()

  if (error || !data) return c.json({ error: 'Failed to review submission' }, 500)

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

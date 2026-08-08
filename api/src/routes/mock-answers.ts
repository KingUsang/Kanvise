import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import { notifyMockFullyGraded } from '../notifications/triggers'
import type { TenantVariables } from '../types'
import { isReviewableAttemptStatus } from '../domain/mock-results'
import { BANK_QUESTION_TYPE_RELATION } from '../lib/postgrest-selects'

export const mockAnswersRouter = new Hono<{ Variables: TenantVariables }>()

mockAnswersRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

mockAnswersRouter.patch('/:answerId/grade', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const { answerId } = c.req.param()
  const { tutor_score, tutor_feedback } = await c.req.json()

  if (tutor_score === undefined || tutor_score === null || !Number.isFinite(Number(tutor_score)) || Number(tutor_score) < 0) {
    return c.json({ error: 'A non-negative numeric score is required', code: 'INVALID_SCORE' }, 400)
  }

  const { data: answer, error: fetchError } = await supabase.from('mock_answers')
    .select(`*,
      question:mock_version_questions(id, marks,
        version:bank_question_versions(${BANK_QUESTION_TYPE_RELATION})
      ),
      attempt:mock_attempts(id, student_id, status, mcq_score, mock_exam_id, mock_exam_version_id,
        mock_exam:mock_exams(id, title, tutor_id, course_id)
      )`)
    .eq('id', answerId)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !answer) return c.json({ error: 'Mock answer not found', code: 'NOT_FOUND' }, 404)
  if ((answer.question as any)?.version?.question?.question_type !== 'theory') {
    return c.json({ error: 'Only theory answers can be manually graded', code: 'NOT_THEORY_ANSWER' }, 409)
  }
  if (Number(tutor_score) > Number((answer.question as any)?.marks || 0)) {
    return c.json({ error: 'Score cannot be higher than the marks available', code: 'SCORE_ABOVE_MAXIMUM' }, 400)
  }

  const attempt = answer.attempt as any
  const mockExam = attempt?.mock_exam as any
  if (!isReviewableAttemptStatus(attempt?.status)) {
    return c.json({ error: 'This attempt has not been submitted', code: 'ATTEMPT_NOT_SUBMITTED' }, 409)
  }
  if (user.role === 'tutor') {
    const { data: assignment } = await supabase.from('tutor_course_assignments')
      .select('id')
      .eq('school_id', user.school_id)
      .eq('tutor_id', user.id)
      .eq('course_id', mockExam?.course_id)
      .maybeSingle()
    if (!assignment) {
      return c.json({ error: 'You are not assigned to this mock’s course', code: 'FORBIDDEN' }, 403)
    }
  }

  const { data, error } = await supabase.from('mock_answers').update({
    tutor_score: Number(tutor_score), tutor_feedback: tutor_feedback || null,
  }).eq('id', answerId).eq('school_id', user.school_id).select().single()
  if (error || !data) return c.json({ error: 'Failed to grade mock answer' }, 500)

  const { data: versionQuestions, error: questionError } = await supabase.from('mock_version_questions')
    .select(`id, version:bank_question_versions(${BANK_QUESTION_TYPE_RELATION})`)
    .eq('mock_exam_version_id', attempt.mock_exam_version_id)
    .eq('school_id', user.school_id)
  if (questionError) return c.json({ error: 'Answer graded but completion check failed' }, 500)

  const theoryIds = (versionQuestions || [])
    .filter((question: any) => question.version?.question?.question_type === 'theory')
    .map((question) => question.id)
  const { data: theoryAnswers, error: answersError } = theoryIds.length
    ? await supabase.from('mock_answers').select('mock_version_question_id, tutor_score')
      .eq('attempt_id', attempt.id).in('mock_version_question_id', theoryIds)
    : { data: [], error: null }
  if (answersError) return c.json({ error: 'Answer graded but completion check failed' }, 500)

  const fullyGraded = theoryIds.length > 0
    && theoryAnswers?.length === theoryIds.length
    && theoryAnswers.every((item) => item.tutor_score !== null)

  let notification = null
  if (fullyGraded && attempt.status !== 'fully_graded') {
    const theoryScore = (theoryAnswers || []).reduce((sum, item) => sum + Number(item.tutor_score || 0), 0)
    const totalScore = Number(attempt.mcq_score || 0) + theoryScore
    const { error: attemptError } = await supabase.from('mock_attempts')
      .update({ status: 'fully_graded', theory_score: theoryScore, total_score: totalScore })
      .eq('id', attempt.id)
      .eq('school_id', user.school_id)
    if (attemptError) return c.json({ error: 'Answer graded but attempt update failed' }, 500)

    notification = await notifyMockFullyGraded({
      attemptId: attempt.id,
      schoolId: answer.school_id,
      studentId: attempt.student_id,
      mockId: attempt.mock_exam_id,
      mockTitle: mockExam?.title || 'Mock exam',
      score: String(totalScore),
    })
  }

  return c.json({ data, fully_graded: fullyGraded, notification })
})

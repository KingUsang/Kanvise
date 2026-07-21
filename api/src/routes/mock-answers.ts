import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import { notifyMockFullyGraded } from '../notifications/triggers'
import type { AppVariables } from '../types'

export const mockAnswersRouter = new Hono<{ Variables: AppVariables }>()

mockAnswersRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

mockAnswersRouter.patch('/:answerId/grade', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const { answerId } = c.req.param()
  const { tutor_score, tutor_feedback } = await c.req.json()

  if (tutor_score === undefined || tutor_score === null || !Number.isFinite(Number(tutor_score)) || Number(tutor_score) < 0) {
    return c.json({ error: 'A non-negative numeric score is required', code: 'INVALID_SCORE' }, 400)
  }

  const { data: answer, error: fetchError } = await supabase.from('mock_answers')
    .select('*, question:mock_questions(question_type), attempt:mock_attempts(id, student_id, status, mcq_score, mock_exam_id, mock_exam:mock_exams(id, title, tutor_id))')
    .eq('id', answerId)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !answer) return c.json({ error: 'Mock answer not found', code: 'NOT_FOUND' }, 404)
  if ((answer.question as any)?.question_type !== 'theory') {
    return c.json({ error: 'Only theory answers can be manually graded', code: 'NOT_THEORY_ANSWER' }, 409)
  }

  const attempt = answer.attempt as any
  const mockExam = attempt?.mock_exam as any
  if (user.role === 'tutor' && mockExam?.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this mock', code: 'FORBIDDEN' }, 403)
  }

  const { data, error } = await supabase.from('mock_answers').update({
    tutor_score: Number(tutor_score), tutor_feedback: tutor_feedback || null,
  }).eq('id', answerId).eq('school_id', user.school_id).select().single()
  if (error || !data) return c.json({ error: 'Failed to grade mock answer' }, 500)

  const { data: theoryQuestions, error: questionError } = await supabase.from('mock_questions')
    .select('id')
    .eq('mock_exam_id', attempt.mock_exam_id)
    .eq('question_type', 'theory')
  if (questionError) return c.json({ error: 'Answer graded but completion check failed' }, 500)

  const theoryIds = (theoryQuestions || []).map((question) => question.id)
  const { data: theoryAnswers, error: answersError } = theoryIds.length
    ? await supabase.from('mock_answers').select('tutor_score').eq('attempt_id', attempt.id).in('question_id', theoryIds)
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
      .update({ status: 'fully_graded' })
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

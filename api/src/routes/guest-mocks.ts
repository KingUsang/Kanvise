import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'
import { attachStudentMedia, loadAttemptQuestionIds, studentQuestionVersionSelect } from './student-mocks'

export const guestMocksRouter = new Hono<{ Variables: AppVariables }>()
const db = supabase as any
const cookieName = 'kanvise_guest_mock'
const guestLifetimeSeconds = 30 * 24 * 60 * 60

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function writeGuestCookie(c: any, token: string) {
  setCookie(c, cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: guestLifetimeSeconds,
  })
}

async function currentGuest(c: any) {
  const token = getCookie(c, cookieName)
  if (!token || !/^[A-Za-z0-9_-]{40,}$/.test(token)) return null
  const { data, error } = await db.from('guest_mock_learners').select('id, expires_at, claimed_at')
    .eq('token_hash', tokenHash(token)).is('claimed_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw error
  return data
}

async function ownedGuestAttempt(guestId: string, attemptId: string) {
  const { data: ownership, error } = await db.from('guest_mock_attempts').select('attempt_id')
    .eq('guest_id', guestId).eq('attempt_id', attemptId).is('transferred_at', null).maybeSingle()
  if (error) throw error
  if (!ownership) return null
  const { data: attempt, error: attemptError } = await db.from('mock_attempts')
    .select('*, mock_exam:mock_exams(id, title, description, calculator_mode, shuffle_questions, shuffle_options, result_release_mode, pass_mark, closes_at, course:courses(name))')
    .eq('id', attemptId).is('student_id', null).eq('access_source', 'guest').maybeSingle()
  if (attemptError) throw attemptError
  return attempt
}

function guestError(c: any, error: any, fallback: string) {
  const message = String(error?.message || '')
  const code = [
    'GUEST_SESSION_NOT_FOUND', 'GUEST_ATTEMPT_NOT_FOUND', 'GUEST_ATTEMPT_ALREADY_USED',
    'GUEST_MOCK_NOT_AVAILABLE', 'ATTEMPT_EXPIRED', 'ATTEMPT_FINALIZED', 'ATTEMPT_LIMIT_REACHED',
    'STUDENT_ATTEMPT_IN_PROGRESS', 'ENTITLEMENT_EXPIRED', 'ATTEMPT_QUESTION_NOT_FOUND',
    'OPTION_NOT_FOUND', 'MCQ_THEORY_ANSWER_INVALID', 'THEORY_OPTION_INVALID',
  ].find(candidate => message.includes(candidate))
  if (!code) {
    console.error('guest_mocks.database_error', { message, code: error?.code })
    return c.json({ error: fallback, code: 'DATABASE_ERROR' }, 500)
  }
  const status = code.includes('NOT_FOUND') || code === 'GUEST_MOCK_NOT_AVAILABLE' ? 404
    : code.includes('EXPIRED') || code.includes('LIMIT') || code.includes('IN_PROGRESS') || code.includes('ALREADY') || code === 'ATTEMPT_FINALIZED' ? 409 : 400
  const publicMessages: Record<string, string> = {
    GUEST_SESSION_NOT_FOUND: 'This guest session has expired. Return to the mock link to begin again.',
    GUEST_ATTEMPT_NOT_FOUND: 'This guest attempt is not available on this browser.',
    GUEST_ATTEMPT_ALREADY_USED: 'The free guest attempt has already been submitted.',
    GUEST_MOCK_NOT_AVAILABLE: 'This mock is not available for guest access.',
    ATTEMPT_EXPIRED: 'Time is up for this attempt.',
    ATTEMPT_FINALIZED: 'This attempt has already ended.',
    ATTEMPT_LIMIT_REACHED: 'This account has already used all attempts for this mock.',
    STUDENT_ATTEMPT_IN_PROGRESS: 'This account already has this mock in progress. Finish that attempt before moving guest progress.',
    ENTITLEMENT_EXPIRED: 'This account’s access to the mock has expired.',
  }
  return c.json({ error: publicMessages[code] || 'The guest attempt could not be updated.', code }, status)
}

guestMocksRouter.post('/guest/mock/:offerId/attempts', async c => {
  try {
    let guest = await currentGuest(c)
    if (!guest) {
      const requestFingerprint = `${c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}:${c.req.header('user-agent') || 'unknown'}`
      const fingerprintHash = createHash('sha256').update(`${process.env.KANVISE_INTERNAL_SECRET || 'kanvise-guest'}:${requestFingerprint}`).digest('hex')
      const { data: withinLimit, error: limitError } = await db.rpc('consume_guest_mock_start_limit', {
        p_fingerprint_hash: fingerprintHash, p_now: new Date().toISOString(), p_max_attempts: 12,
      })
      if (limitError) throw limitError
      if (!withinLimit) return c.json({ error: 'Too many guest attempts were started from this device. Try again later.', code: 'RATE_LIMITED' }, 429)
      const token = randomBytes(32).toString('base64url')
      const { data, error } = await db.from('guest_mock_learners').insert({
        token_hash: tokenHash(token),
        expires_at: new Date(Date.now() + guestLifetimeSeconds * 1000).toISOString(),
      }).select('id').single()
      if (error || !data) throw error || new Error('Could not create guest session')
      guest = data
      writeGuestCookie(c, token)
    }
    const { data, error } = await db.rpc('start_or_resume_guest_mock_attempt', {
      p_guest_id: guest.id, p_offer_id: c.req.param('offerId')!, p_now: new Date().toISOString(),
    })
    if (error) return guestError(c, error, 'Could not start this guest mock')
    return c.json({ data: data?.[0] || data }, 201)
  } catch (error) { return guestError(c, error, 'Could not start this guest mock') }
})

guestMocksRouter.get('/guest/attempts/:attemptId', async c => {
  try {
    const guest = await currentGuest(c)
    if (!guest) return c.json({ error: 'This guest session is not available on this browser.', code: 'GUEST_SESSION_NOT_FOUND' }, 401)
    const attempt = await ownedGuestAttempt(guest.id, c.req.param('attemptId')!)
    if (!attempt) return c.json({ error: 'Guest attempt not found', code: 'GUEST_ATTEMPT_NOT_FOUND' }, 404)
    if (attempt.status !== 'in_progress') return c.json({ error: 'Attempt has ended', code: 'ATTEMPT_FINALIZED' }, 409)
    const questionIds = await loadAttemptQuestionIds(attempt.id, attempt.school_id)
    const [{ data: snapshots, error: questionError }, { data: answers, error: answerError }] = await Promise.all([
      db.from('mock_version_questions')
        .select(`id, section_title, section_order_index, order_index, marks, version:bank_question_versions(id, plain_text, content_blocks, stimulus:question_stimuli(id, title, plain_text, content_blocks), ${studentQuestionVersionSelect}, options:bank_question_option_versions(id, plain_text, content_blocks, order_index))`)
        .eq('school_id', attempt.school_id).eq('mock_exam_version_id', attempt.mock_exam_version_id).in('id', questionIds)
        .order('section_order_index').order('order_index'),
      db.from('mock_answers').select('mock_version_question_id, selected_option_version_id, theory_answer_text, is_flagged, saved_at')
        .eq('school_id', attempt.school_id).eq('attempt_id', attempt.id),
    ])
    if (questionError || answerError) throw questionError || answerError
    let questions = (snapshots || []).map((snapshot: any) => ({
      id: snapshot.id, section_title: snapshot.section_title, section_order_index: snapshot.section_order_index,
      order_index: snapshot.order_index, marks: snapshot.marks, question_type: snapshot.version?.question?.question_type,
      plain_text: snapshot.version?.plain_text || '', content_blocks: snapshot.version?.content_blocks || [],
      stimulus: snapshot.version?.stimulus || null,
      options: (snapshot.version?.options || []).map(({ id, plain_text, content_blocks, order_index }: any) => ({ id, plain_text, content_blocks, order_index })),
    }))
    if (attempt.mock_exam?.shuffle_questions) questions = [...questions].sort((a: any, b: any) => tokenHash(`${attempt.id}:${a.id}`).localeCompare(tokenHash(`${attempt.id}:${b.id}`)))
    questions = questions.map((question: any) => ({ ...question, options: attempt.mock_exam?.shuffle_options
      ? [...question.options].sort((a: any, b: any) => tokenHash(`${attempt.id}:${question.id}:${a.id}`).localeCompare(tokenHash(`${attempt.id}:${question.id}:${b.id}`)))
      : question.options }))
    questions = await attachStudentMedia(questions, attempt.school_id)
    return c.json({ data: {
      attempt: { id: attempt.id, status: attempt.status, attempt_number: attempt.attempt_number, started_at: attempt.started_at, deadline_at: attempt.deadline_at, last_saved_at: attempt.last_saved_at },
      mock: attempt.mock_exam, questions, answers: answers || [],
    }, server_now: new Date().toISOString() })
  } catch (error) { return guestError(c, error, 'Could not load this guest attempt') }
})

guestMocksRouter.put('/guest/attempts/:attemptId/answers/:questionId', async c => {
  const body = await c.req.json().catch(() => ({}))
  if (body.selected_option_version_id != null && typeof body.selected_option_version_id !== 'string') return c.json({ error: 'Invalid selected option' }, 400)
  if (body.theory_answer_text != null && (typeof body.theory_answer_text !== 'string' || body.theory_answer_text.length > 20000)) return c.json({ error: 'Theory answer is too long' }, 400)
  try {
    const guest = await currentGuest(c)
    if (!guest) return c.json({ error: 'This guest session has expired.', code: 'GUEST_SESSION_NOT_FOUND' }, 401)
    const { data, error } = await db.rpc('save_guest_mock_answer', {
      p_guest_id: guest.id, p_attempt_id: c.req.param('attemptId')!, p_mock_version_question_id: c.req.param('questionId')!,
      p_selected_option_version_id: body.selected_option_version_id || null, p_theory_answer_text: body.theory_answer_text ?? null,
      p_is_flagged: body.is_flagged === true, p_now: new Date().toISOString(),
    })
    if (error) return guestError(c, error, 'Could not save your answer')
    return c.json({ data: data?.[0] || data })
  } catch (error) { return guestError(c, error, 'Could not save your answer') }
})

guestMocksRouter.post('/guest/attempts/:attemptId/submit', async c => {
  try {
    const guest = await currentGuest(c)
    if (!guest) return c.json({ error: 'This guest session has expired.', code: 'GUEST_SESSION_NOT_FOUND' }, 401)
    const { data, error } = await db.rpc('submit_guest_mock_attempt', {
      p_guest_id: guest.id, p_attempt_id: c.req.param('attemptId')!, p_now: new Date().toISOString(), p_reason: 'student',
    })
    if (error) return guestError(c, error, 'Could not submit this mock')
    return c.json({ data: data?.[0] || data })
  } catch (error) { return guestError(c, error, 'Could not submit this mock') }
})

guestMocksRouter.get('/guest/attempts/:attemptId/result', async c => {
  try {
    const guest = await currentGuest(c)
    if (!guest) return c.json({ error: 'This guest session has expired.', code: 'GUEST_SESSION_NOT_FOUND' }, 401)
    const attempt = await ownedGuestAttempt(guest.id, c.req.param('attemptId')!)
    if (!attempt) return c.json({ error: 'Guest attempt not found', code: 'GUEST_ATTEMPT_NOT_FOUND' }, 404)
    if (attempt.status === 'in_progress') return c.json({ error: 'Submit the mock before viewing results', code: 'ATTEMPT_IN_PROGRESS' }, 409)
    return c.json({ data: {
      attempt: { id: attempt.id, status: attempt.status, submitted_at: attempt.submitted_at, total_score: attempt.total_score, total_marks: attempt.total_marks },
      mock: { title: attempt.mock_exam?.title, pass_mark: attempt.mock_exam?.pass_mark, course: attempt.mock_exam?.course },
    } })
  } catch (error) { return guestError(c, error, 'Could not load this result') }
})

guestMocksRouter.post('/guest/attempts/:attemptId/transfer', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  try {
    const guest = await currentGuest(c)
    if (!guest) return c.json({ error: 'This guest session has expired.', code: 'GUEST_SESSION_NOT_FOUND' }, 401)
    const user = c.get('user')
    const { data, error } = await db.rpc('transfer_guest_mock_attempt', {
      p_guest_id: guest.id, p_attempt_id: c.req.param('attemptId')!, p_student_id: user.id, p_now: new Date().toISOString(),
    })
    if (error) return guestError(c, error, 'Could not save guest progress to your account')
    deleteCookie(c, cookieName, { path: '/' })
    return c.json({ data: data?.[0] || data })
  } catch (error) { return guestError(c, error, 'Could not save guest progress to your account') }
})

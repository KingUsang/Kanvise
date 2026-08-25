import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { loadStudentMockAudience, studentCanAccessCentreMock } from '../lib/student-mock-audience'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from '../middleware/auth'
import { createPresignedDownload } from '../storage/r2'
import type { AppVariables } from '../types'

export const studentMocksRouter = new Hono<{ Variables: AppVariables }>()

// `bank_questions.current_version_id` and `bank_question_versions.question_id`
// create two PostgREST relationships between these tables. Student reads always
// need the question that owns a version, so the foreign-key hint is mandatory.
export const studentQuestionVersionSelect = 'question:bank_questions!bank_question_versions_question_id_fkey(question_type)'

// A marketplace learner has no centre, but can still own a valid attempt. Each
// route below performs its own course/entitlement check; do not put the generic
// school-required middleware back on this router.
// This router is mounted at `/` because it owns more than one public prefix.
// Auth is attached to each endpoint below rather than router-wide middleware:
// a catch-all middleware here can intercept unrelated admin routes.

const attemptErrors = [
  'MOCK_NOT_AVAILABLE', 'MOCK_NOT_OPEN', 'MOCK_CLOSED', 'MOCK_VERSION_NOT_FOUND',
  'ATTEMPT_LIMIT_REACHED', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_FINALIZED', 'ATTEMPT_EXPIRED',
  'ATTEMPT_QUESTION_NOT_FOUND', 'OPTION_NOT_FOUND', 'MCQ_THEORY_ANSWER_INVALID',
  'THEORY_OPTION_INVALID', 'INVALID_SUBMISSION_REASON', 'PROGRAMME_ENROLMENT_REQUIRED',
  'STUDENT_SUBJECTS_NOT_SET', 'MOCK_HAS_NO_QUESTIONS_FOR_SUBJECTS',
]

function attemptDatabaseError(c: any, error: any, fallback: string) {
  const message = String(error?.message || '')
  const code = attemptErrors.find(candidate => message.includes(candidate))
  if (code) {
    const status = code === 'ATTEMPT_NOT_FOUND' ? 404
      : ['ATTEMPT_FINALIZED', 'ATTEMPT_EXPIRED', 'ATTEMPT_LIMIT_REACHED', 'MOCK_CLOSED'].includes(code) ? 409
        : ['MOCK_NOT_AVAILABLE', 'MOCK_VERSION_NOT_FOUND'].includes(code) ? 404 : 400
    return c.json({ error: code.replaceAll('_', ' ').toLowerCase(), code }, status)
  }
  console.error('student_mocks.database_error', { message, code: error?.code })
  return c.json({ error: fallback, code: 'DATABASE_ERROR' }, 500)
}

async function accessibleMock(user: any, mockId: string) {
  if (!user.school_id) return null
  const { data, error } = await supabase.from('mock_exams')
    .select('*, course:courses(id, name)')
    .eq('id', mockId).eq('school_id', user.school_id).eq('status', 'published').maybeSingle()
  if (error) throw error
  if (!data) return null
  return studentCanAccessCentreMock(data, await loadStudentMockAudience(user)) ? data : null
}

function availability(mock: any, now: Date) {
  if (mock.available_from && now < new Date(mock.available_from)) return 'upcoming'
  if (mock.closes_at && now >= new Date(mock.closes_at)) return 'closed'
  return 'open'
}

async function marketplaceMockGroups(user: any) {
  const groups: Record<string, any[]> = { available: [], in_progress: [], upcoming: [], completed: [] }
  const { data: entitlements, error } = await supabase.from('mock_marketplace_entitlements').select(`
    id, attempts_granted, attempts_consumed, granted_at, expires_at,
    listing:mock_marketplace_listings(id, source_mock_id, mock_version_id, title, short_description, available_from, closes_at,
      duration_minutes, question_count, total_marks, calculator_mode, approval_status, publication_status, creator_school:schools!mock_marketplace_listings_creator_school_id_fkey(name))
  `).eq('student_id', user.id).is('revoked_at', null).order('granted_at', { ascending: false })
  if (error) throw error
  const active = (entitlements || []).filter((item: any) => item.listing && (!item.expires_at || new Date(item.expires_at) > new Date()))
  if (!active.length) return groups
  const entitlementIds = active.map((item: any) => item.id)
  const { data: attempts, error: attemptsError } = await supabase.from('mock_attempts')
    .select('id, marketplace_entitlement_id, attempt_number, status, started_at, deadline_at, submitted_at, total_score, total_marks')
    .eq('student_id', user.id).in('marketplace_entitlement_id', entitlementIds)
  if (attemptsError) throw attemptsError
  const now = new Date()
  for (const entitlement of active as any[]) {
    const listing = entitlement.listing
    const listingAttempts = (attempts || []).filter((attempt: any) => attempt.marketplace_entitlement_id === entitlement.id)
    const inProgress = listingAttempts.find((attempt: any) => attempt.status === 'in_progress' && (!attempt.deadline_at || now < new Date(attempt.deadline_at)))
    const completed = [...listingAttempts].filter((attempt: any) => attempt.status !== 'in_progress').sort((a: any, b: any) => b.attempt_number - a.attempt_number)[0]
    const item = {
      id: listing.source_mock_id, marketplace_listing_id: listing.id, source: 'marketplace', title: listing.title,
      description: listing.short_description, course_id: null, course: listing.creator_school ? { name: (listing.creator_school as any).name } : null,
      available_from: listing.available_from, closes_at: listing.closes_at, time_limit_minutes: listing.duration_minutes,
      calculator_mode: listing.calculator_mode, version: { id: listing.mock_version_id, total_questions: listing.question_count, total_marks: listing.total_marks },
      attempts_used: entitlement.attempts_consumed, attempts_allowed: entitlement.attempts_granted,
    }
    if (inProgress) groups.in_progress.push({ ...item, attempt: inProgress })
    else if (completed && entitlement.attempts_consumed >= entitlement.attempts_granted) groups.completed.push({ ...item, attempt: completed })
    else if (listing.approval_status === 'approved' && listing.publication_status === 'listed') {
      const state = availability(listing, now)
      if (state === 'open') groups.available.push(item)
      if (state === 'upcoming') groups.upcoming.push(item)
      if (state === 'closed' && completed) groups.completed.push({ ...item, attempt: completed })
    } else if (completed) groups.completed.push({ ...item, attempt: completed })
  }
  return groups
}

function seededOrder<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort((a, b) => createHash('sha256').update(`${seed}:${a.id}`).digest('hex')
    .localeCompare(createHash('sha256').update(`${seed}:${b.id}`).digest('hex')))
}

function imageMediaIds(blocks: any[]) {
  return (blocks || []).flatMap(block => block?.type === 'image' && typeof block.media_id === 'string' ? [block.media_id] : [])
}

async function attachStudentMedia(questions: any[], schoolId: string) {
  const ids = [...new Set(questions.flatMap(question => [
    ...imageMediaIds(question.content_blocks),
    ...imageMediaIds(question.explanation_blocks),
    ...imageMediaIds(question.stimulus?.content_blocks),
    ...(question.options || []).flatMap((option: any) => imageMediaIds(option.content_blocks)),
  ]))]
  if (!ids.length) return questions
  const { data, error } = await supabase.from('question_media').select('id, storage_key, alt_text, width, height')
    .eq('school_id', schoolId).eq('processing_status', 'ready').in('id', ids)
  if (error) throw error
  const media = new Map(await Promise.all((data || []).map(async item => [item.id, {
    id: item.id, alt_text: item.alt_text, width: item.width, height: item.height,
    url: await createPresignedDownload(item.storage_key, schoolId),
  }] as const)))
  const attach = (blocks: any[]) => (blocks || []).map(block => block?.type === 'image'
    ? { ...block, ...media.get(block.media_id) } : block)
  return questions.map(question => ({
    ...question,
    content_blocks: attach(question.content_blocks),
    explanation_blocks: attach(question.explanation_blocks),
    stimulus: question.stimulus ? { ...question.stimulus, content_blocks: attach(question.stimulus.content_blocks) } : null,
    options: (question.options || []).map((option: any) => ({ ...option, content_blocks: attach(option.content_blocks) })),
  }))
}

async function latestVersion(mockId: string, schoolId: string) {
  const { data, error } = await supabase.from('mock_exam_versions').select('*')
    .eq('mock_exam_id', mockId).eq('school_id', schoolId)
    .order('version_number', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}

async function submitAttempt(user: any, schoolId: string, attemptId: string, reason: 'student' | 'timeout') {
  return supabase.rpc('submit_versioned_mock_attempt', {
    p_school_id: schoolId,
    p_attempt_id: attemptId,
    p_student_id: user.id,
    p_now: new Date().toISOString(),
    p_reason: reason,
  })
}

async function ownedAttemptSchoolId(user: any, attemptId: string) {
  const { data, error } = await supabase.from('mock_attempts').select('school_id')
    .eq('id', attemptId).eq('student_id', user.id).maybeSingle()
  if (error) throw error
  return data?.school_id || null
}

async function loadAttemptQuestionIds(attemptId: string, schoolId: string) {
  const client = supabase as any
  const { data, error } = await client.from('mock_attempt_questions').select('mock_version_question_id')
    .eq('school_id', schoolId).eq('attempt_id', attemptId)
  if (error) throw error
  return (data || []).map((item: any) => item.mock_version_question_id)
}

async function loadAttempt(user: any, attemptId: string, lazyFinalize = true) {
  let { data, error } = await supabase.from('mock_attempts')
    .select('*, mock_exam:mock_exams(id, title, description, course_id, calculator_mode, shuffle_questions, shuffle_options, result_release_mode, pass_mark, closes_at, course:courses(name)), version:mock_exam_versions(id, version_number, settings, total_questions, total_marks)')
    .eq('id', attemptId).eq('student_id', user.id).maybeSingle()
  if (error) throw error
  if (data?.status === 'in_progress' && data.deadline_at && new Date() >= new Date(data.deadline_at) && lazyFinalize) {
    const result = await submitAttempt(user, data.school_id, attemptId, 'timeout')
    if (result.error) throw result.error
    const reloaded = await supabase.from('mock_attempts')
      .select('*, mock_exam:mock_exams(id, title, description, course_id, calculator_mode, shuffle_questions, shuffle_options, result_release_mode, pass_mark, closes_at, course:courses(name)), version:mock_exam_versions(id, version_number, settings, total_questions, total_marks)')
      .eq('id', attemptId).eq('student_id', user.id).maybeSingle()
    if (reloaded.error) throw reloaded.error
    data = reloaded.data
  }
  return data
}

studentMocksRouter.get('/students/me/mocks', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  try {
    if (!user.school_id) return c.json({ data: await marketplaceMockGroups(user), server_now: new Date().toISOString() })
    const audience = await loadStudentMockAudience(user)
    const { data: mocks, error } = await supabase.from('mock_exams')
      .select('id, title, description, course_id, programme_id, audience_scope, publish_at, available_from, closes_at, time_limit_minutes, calculator_mode, max_attempts, course:courses(name), programme:programmes(name), versions:mock_exam_versions(id, version_number, total_questions, total_marks)')
      .eq('school_id', user.school_id).eq('status', 'published')
      .order('available_from', { ascending: true, nullsFirst: true })
    if (error) throw error
    const visibleMocks = (mocks || []).filter((mock: any) => studentCanAccessCentreMock(mock, audience))
    const versionByMock = new Map(visibleMocks.flatMap((mock: any) => {
      const version = [...(mock.versions || [])].sort((a: any, b: any) => b.version_number - a.version_number)[0]
      return version ? [[mock.id, version] as const] : []
    }))
    const versionIds = [...versionByMock.values()].map((version: any) => version.id)
    const [{ data: attempts, error: attemptError }, { data: grants, error: grantError }] = versionIds.length
      ? await Promise.all([
        supabase.from('mock_attempts').select('id, mock_exam_id, mock_exam_version_id, attempt_number, status, started_at, deadline_at, submitted_at, total_score, total_marks')
          .eq('school_id', user.school_id).eq('student_id', user.id).in('mock_exam_version_id', versionIds),
        supabase.from('mock_attempt_grants').select('mock_exam_version_id, additional_attempts')
          .eq('school_id', user.school_id).eq('student_id', user.id).is('revoked_at', null).in('mock_exam_version_id', versionIds),
      ]) : [{ data: [], error: null }, { data: [], error: null }]
    if (attemptError || grantError) throw attemptError || grantError

    const now = new Date()
    for (const attempt of attempts || []) {
      if (attempt.status === 'in_progress' && attempt.deadline_at && now >= new Date(attempt.deadline_at)) {
        const finalized = await submitAttempt(user, user.school_id!, attempt.id, 'timeout')
        if (finalized.error) throw finalized.error
        Object.assign(attempt, finalized.data?.[0] || {}, { status: finalized.data?.[0]?.status || 'timed_out' })
      }
    }
    const groups: Record<string, any[]> = { available: [], in_progress: [], upcoming: [], completed: [] }
    for (const mock of visibleMocks) {
      const version: any = versionByMock.get(mock.id)
      if (!version) continue
      const mockAttempts = (attempts || []).filter((attempt: any) => attempt.mock_exam_version_id === version.id)
      const active = mockAttempts.find((attempt: any) => attempt.status === 'in_progress')
      const completed = [...mockAttempts].filter((attempt: any) => attempt.status !== 'in_progress')
        .sort((a: any, b: any) => b.attempt_number - a.attempt_number)[0]
      const extra = (grants || []).filter((grant: any) => grant.mock_exam_version_id === version.id)
        .reduce((sum: number, grant: any) => sum + grant.additional_attempts, 0)
      const item = { ...mock, versions: undefined, version, attempts_used: mockAttempts.length, attempts_allowed: mock.max_attempts + extra }
      if (active) groups.in_progress.push({ ...item, attempt: active })
      else if (completed && mockAttempts.length >= mock.max_attempts + extra) groups.completed.push({ ...item, attempt: completed })
      else {
        const state = availability(mock, now)
        if (state === 'upcoming') groups.upcoming.push(item)
        else if (state === 'open') groups.available.push(item)
        else if (completed) groups.completed.push({ ...item, attempt: completed })
      }
    }
    const marketplaceGroups = await marketplaceMockGroups(user)
    for (const key of Object.keys(groups)) groups[key].push(...marketplaceGroups[key])
    return c.json({ data: groups, server_now: now.toISOString() })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not load your mocks')
  }
})

studentMocksRouter.get('/mocks/:mockId/preflight', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  try {
    const mock = await accessibleMock(user, c.req.param('mockId')!)
    if (!mock) return c.json({ error: 'Mock not found', code: 'MOCK_NOT_FOUND' }, 404)
    const version = await latestVersion(mock.id, user.school_id!)
    if (!version) return c.json({ error: 'Mock not found', code: 'MOCK_VERSION_NOT_FOUND' }, 404)
    const [{ data: attempts, error: attemptError }, { data: grants, error: grantError }] = await Promise.all([
      supabase.from('mock_attempts').select('id, attempt_number, status, deadline_at, submitted_at')
        .eq('school_id', user.school_id!).eq('student_id', user.id).eq('mock_exam_version_id', version.id),
      supabase.from('mock_attempt_grants').select('additional_attempts').eq('school_id', user.school_id!)
        .eq('student_id', user.id).eq('mock_exam_version_id', version.id).is('revoked_at', null),
    ])
    if (attemptError || grantError) throw attemptError || grantError
    for (const attempt of attempts || []) {
      if (attempt.status === 'in_progress' && attempt.deadline_at && new Date() >= new Date(attempt.deadline_at)) {
        const finalized = await submitAttempt(user, user.school_id!, attempt.id, 'timeout')
        if (finalized.error) throw finalized.error
        Object.assign(attempt, finalized.data?.[0] || {}, { status: finalized.data?.[0]?.status || 'timed_out' })
      }
    }
    const extra = (grants || []).reduce((sum: number, grant: any) => sum + grant.additional_attempts, 0)
    let subjectCombination: any = null
    if (mock.delivery_mode === 'subject_combination') {
      if (!mock.programme_id) return c.json({ error: 'This adaptive mock needs a programme', code: 'MOCK_CONFIGURATION_INVALID' }, 409)
      const client = supabase as any
      const [{ data: courses, error: courseError }, { data: selected, error: selectionError }] = await Promise.all([
        supabase.from('courses').select('id, name').eq('school_id', user.school_id!).eq('programme_id', mock.programme_id).eq('is_published', true).order('name'),
        client.from('student_programme_subjects').select('course_id').eq('school_id', user.school_id!)
          .eq('student_id', user.id).eq('programme_id', mock.programme_id),
      ])
      if (courseError || selectionError) throw courseError || selectionError
      subjectCombination = {
        programme_id: mock.programme_id,
        required_count: 4,
        courses: courses || [],
        selected_course_ids: (selected || []).map((item: any) => item.course_id),
      }
    }
    return c.json({ data: {
      mock: {
        id: mock.id, title: mock.title, description: mock.description, course: mock.course,
        time_limit_minutes: mock.time_limit_minutes, available_from: mock.available_from,
        closes_at: mock.closes_at, calculator_mode: mock.calculator_mode,
        result_release_mode: mock.result_release_mode, pass_mark: mock.pass_mark,
      },
      version: { id: version.id, total_questions: version.total_questions, total_marks: version.total_marks },
      availability: availability(mock, new Date()),
      attempts_used: (attempts || []).length,
      attempts_allowed: mock.max_attempts + extra,
      resumable_attempt: (attempts || []).find((attempt: any) => attempt.status === 'in_progress') || null,
      subject_combination: subjectCombination,
    }, server_now: new Date().toISOString() })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not load mock instructions')
  }
})

studentMocksRouter.post('/mocks/:mockId/attempts', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  try {
    const mock = await accessibleMock(user, c.req.param('mockId')!)
    if (!mock) return c.json({ error: 'Mock not found', code: 'MOCK_NOT_FOUND' }, 404)
    let result = await supabase.rpc('start_or_resume_versioned_mock_attempt', {
      p_school_id: user.school_id!, p_mock_exam_id: mock.id, p_student_id: user.id, p_now: new Date().toISOString(),
    })
    if (result.error && String(result.error.message).includes('ATTEMPT_EXPIRED')) {
      const version = await latestVersion(mock.id, user.school_id!)
      const { data: expired } = await supabase.from('mock_attempts').select('id').eq('school_id', user.school_id!)
        .eq('student_id', user.id).eq('mock_exam_version_id', version!.id).eq('status', 'in_progress').maybeSingle()
      if (expired) {
        const finalized = await submitAttempt(user, user.school_id!, expired.id, 'timeout')
        if (finalized.error) throw finalized.error
      }
      result = await supabase.rpc('start_or_resume_versioned_mock_attempt', {
        p_school_id: user.school_id!, p_mock_exam_id: mock.id, p_student_id: user.id, p_now: new Date().toISOString(),
      })
    }
    if (result.error) return attemptDatabaseError(c, result.error, 'Could not start the mock')
    return c.json({ data: result.data?.[0] || result.data, server_now: new Date().toISOString() }, 201)
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not start the mock')
  }
})

studentMocksRouter.get('/attempts/:attemptId', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  try {
    const attempt = await loadAttempt(user, c.req.param('attemptId')!)
    if (!attempt) return c.json({ error: 'Attempt not found', code: 'ATTEMPT_NOT_FOUND' }, 404)
    if (attempt.status !== 'in_progress') return c.json({ error: 'Attempt has ended', code: 'ATTEMPT_FINALIZED', data: { status: attempt.status } }, 409)
    const questionIds = await loadAttemptQuestionIds(attempt.id, attempt.school_id)
    const [{ data: snapshots, error: questionError }, { data: answers, error: answerError }] = await Promise.all([
      supabase.from('mock_version_questions')
        .select(`id, section_title, section_order_index, order_index, marks, version:bank_question_versions(id, plain_text, content_blocks, stimulus:question_stimuli(id, title, plain_text, content_blocks), ${studentQuestionVersionSelect}, options:bank_question_option_versions(id, plain_text, content_blocks, order_index))`)
        .eq('school_id', attempt.school_id).eq('mock_exam_version_id', attempt.mock_exam_version_id!).in('id', questionIds)
        .order('section_order_index').order('order_index'),
      supabase.from('mock_answers').select('mock_version_question_id, selected_option_version_id, theory_answer_text, is_flagged, saved_at')
        .eq('school_id', attempt.school_id).eq('attempt_id', attempt.id),
    ])
    if (questionError || answerError) throw questionError || answerError
    let questions = (snapshots || []).map((snapshot: any) => ({
      id: snapshot.id, section_title: snapshot.section_title, section_order_index: snapshot.section_order_index,
      order_index: snapshot.order_index, marks: snapshot.marks,
      question_type: snapshot.version?.question?.question_type,
      plain_text: snapshot.version?.plain_text || '', content_blocks: snapshot.version?.content_blocks || [],
      stimulus: snapshot.version?.stimulus || null,
      options: (snapshot.version?.options || []).map(({ id, plain_text, content_blocks, order_index }: any) => ({ id, plain_text, content_blocks, order_index })),
    }))
    if (attempt.mock_exam?.shuffle_questions) questions = seededOrder(questions, attempt.id)
    questions = questions.map((question: any) => ({
      ...question,
      options: attempt.mock_exam?.shuffle_options ? seededOrder(question.options, `${attempt.id}:${question.id}`) : question.options,
    }))
    questions = await attachStudentMedia(questions, attempt.school_id)
    return c.json({ data: {
      attempt: {
        id: attempt.id, status: attempt.status, attempt_number: attempt.attempt_number,
        started_at: attempt.started_at, deadline_at: attempt.deadline_at, last_saved_at: attempt.last_saved_at,
      },
      mock: attempt.mock_exam,
      questions,
      answers: answers || [],
    }, server_now: new Date().toISOString() })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not load your attempt')
  }
})

studentMocksRouter.put('/attempts/:attemptId/answers/:questionId', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  const body = await c.req.json()
  if (body.selected_option_version_id !== null && body.selected_option_version_id !== undefined
    && typeof body.selected_option_version_id !== 'string') {
    return c.json({ error: 'Invalid selected option', code: 'VALIDATION_ERROR' }, 400)
  }
  if (body.theory_answer_text !== null && body.theory_answer_text !== undefined
    && (typeof body.theory_answer_text !== 'string' || body.theory_answer_text.length > 20000)) {
    return c.json({ error: 'Theory answer is too long', code: 'VALIDATION_ERROR' }, 400)
  }
  try {
    const schoolId = await ownedAttemptSchoolId(user, c.req.param('attemptId')!)
    if (!schoolId) return c.json({ error: 'Attempt not found', code: 'ATTEMPT_NOT_FOUND' }, 404)
    const { data, error } = await supabase.rpc('save_versioned_mock_answer', {
      p_school_id: schoolId,
      p_attempt_id: c.req.param('attemptId')!,
      p_student_id: user.id,
      p_mock_version_question_id: c.req.param('questionId')!,
      p_selected_option_version_id: body.selected_option_version_id || null,
      p_theory_answer_text: body.theory_answer_text ?? null,
      p_is_flagged: body.is_flagged === true,
      p_now: new Date().toISOString(),
    })
    if (error) return attemptDatabaseError(c, error, 'Could not save your answer')
    return c.json({ data: data?.[0] || data })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not save your answer')
  }
})

studentMocksRouter.patch('/attempts/:attemptId/questions/:questionId/flag', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  const body = await c.req.json()
  if (typeof body.is_flagged !== 'boolean') return c.json({ error: 'is_flagged must be true or false', code: 'VALIDATION_ERROR' }, 400)
  try {
    const schoolId = await ownedAttemptSchoolId(user, c.req.param('attemptId')!)
    if (!schoolId) return c.json({ error: 'Attempt not found', code: 'ATTEMPT_NOT_FOUND' }, 404)
    const { data: current, error: loadError } = await supabase.from('mock_answers')
      .select('selected_option_version_id, theory_answer_text').eq('school_id', schoolId)
      .eq('attempt_id', c.req.param('attemptId')!).eq('mock_version_question_id', c.req.param('questionId')!).maybeSingle()
    if (loadError) throw loadError
    const { data, error } = await supabase.rpc('save_versioned_mock_answer', {
      p_school_id: schoolId, p_attempt_id: c.req.param('attemptId')!, p_student_id: user.id,
      p_mock_version_question_id: c.req.param('questionId')!,
      // The SQL function accepts NULL for these args; generated types mark them non-null.
      p_selected_option_version_id: (current?.selected_option_version_id ?? null) as unknown as string,
      p_theory_answer_text: (current?.theory_answer_text ?? null) as unknown as string,
      p_is_flagged: body.is_flagged, p_now: new Date().toISOString(),
    })
    if (error) return attemptDatabaseError(c, error, 'Could not update review flag')
    return c.json({ data: data?.[0] || data })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not update review flag')
  }
})

studentMocksRouter.post('/attempts/:attemptId/submit', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  try {
    const schoolId = await ownedAttemptSchoolId(user, c.req.param('attemptId')!)
    if (!schoolId) return c.json({ error: 'Attempt not found', code: 'ATTEMPT_NOT_FOUND' }, 404)
    const { data, error } = await submitAttempt(user, schoolId, c.req.param('attemptId')!, 'student')
    if (error) return attemptDatabaseError(c, error, 'Could not submit your mock')
    // Snapshot-total triggers run after the RPC's UPDATE ... RETURNING, so
    // reload the attempt before responding. This matters for adaptive mocks,
    // where a student's four subjects are a subset of the published version.
    const { data: attempt, error: reloadError } = await supabase.from('mock_attempts')
      .select('status, mcq_score, total_score, total_marks, submitted_at')
      .eq('id', c.req.param('attemptId')!).eq('school_id', schoolId).eq('student_id', user.id).maybeSingle()
    if (reloadError || !attempt) return c.json({ error: 'Mock was submitted but could not be reloaded', code: 'ATTEMPT_RELOAD_FAILED' }, 500)
    return c.json({ data: attempt || data?.[0] || data })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not submit your mock')
  }
})

studentMocksRouter.get('/attempts/:attemptId/results', jwtVerificationMiddleware, profileResolutionMiddleware, requireRole('student'), async c => {
  const user = c.get('user')
  try {
    const attempt = await loadAttempt(user, c.req.param('attemptId')!)
    if (!attempt) return c.json({ error: 'Attempt not found', code: 'ATTEMPT_NOT_FOUND' }, 404)
    if (attempt.status === 'in_progress') return c.json({ error: 'Submit the mock before viewing results', code: 'ATTEMPT_IN_PROGRESS' }, 409)
    const mode = attempt.mock_exam?.result_release_mode || 'score_only'
    const questionIds = await loadAttemptQuestionIds(attempt.id, attempt.school_id)
    const { data: questionTypes, error: typeError } = await supabase.from('mock_version_questions')
      .select(`id, version:bank_question_versions(${studentQuestionVersionSelect})`)
      .eq('school_id', attempt.school_id).eq('mock_exam_version_id', attempt.mock_exam_version_id!).in('id', questionIds)
    if (typeError) throw typeError
    const theoryIds = (questionTypes || []).filter((item: any) => (item.version as any)?.question?.question_type === 'theory').map((item: any) => item.id)
    const { data: theoryAnswers, error: theoryError } = theoryIds.length
      ? await supabase.from('mock_answers').select('mock_version_question_id, tutor_score')
        .eq('school_id', attempt.school_id).eq('attempt_id', attempt.id).in('mock_version_question_id', theoryIds)
      : { data: [], error: null }
    if (theoryError) throw theoryError
    const scoredTheoryIds = new Set((theoryAnswers || []).filter((answer: any) => answer.tutor_score !== null).map((answer: any) => answer.mock_version_question_id))
    const theoryGradingPending = theoryIds.some((id: string) => !scoredTheoryIds.has(id))
    const correctionsReleased = mode === 'immediately_with_corrections'
      || (mode === 'after_close' && attempt.mock_exam?.closes_at && new Date() >= new Date(attempt.mock_exam.closes_at))
      || (mode === 'after_theory_grading' && attempt.status === 'fully_graded')
    let corrections: any[] | undefined
    if (correctionsReleased) {
      const { data, error } = await supabase.from('mock_version_questions')
        .select(`id, section_title, order_index, marks, version:bank_question_versions(plain_text, content_blocks, explanation_blocks, ${studentQuestionVersionSelect}, options:bank_question_option_versions(id, plain_text, content_blocks, is_correct, order_index))`)
        .eq('school_id', attempt.school_id).eq('mock_exam_version_id', attempt.mock_exam_version_id!).in('id', questionIds)
        .order('section_order_index').order('order_index')
      if (error) throw error
      const { data: answers, error: answerError } = await supabase.from('mock_answers')
        .select('mock_version_question_id, selected_option_version_id, theory_answer_text, is_correct, tutor_score, tutor_feedback')
        .eq('school_id', attempt.school_id).eq('attempt_id', attempt.id)
      if (answerError) throw answerError
      const answerMap = new Map((answers || []).map((answer: any) => [answer.mock_version_question_id, answer]))
      corrections = (data || []).map((snapshot: any) => ({
        id: snapshot.id, section_title: snapshot.section_title, order_index: snapshot.order_index,
        marks: snapshot.marks, question_type: snapshot.version?.question?.question_type,
        plain_text: snapshot.version?.plain_text, content_blocks: snapshot.version?.content_blocks || [],
        explanation_blocks: snapshot.version?.explanation_blocks || [], options: snapshot.version?.options || [],
        answer: answerMap.get(snapshot.id) || null,
      }))
      corrections = await attachStudentMedia(corrections, attempt.school_id)
    }
    return c.json({ data: {
      attempt: {
        id: attempt.id, status: attempt.status, submitted_at: attempt.submitted_at,
        mcq_score: attempt.mcq_score, theory_score: attempt.theory_score,
        total_score: attempt.total_score, total_marks: attempt.total_marks,
        correct_mcq_answers: attempt.correct_mcq_answers, total_mcq_questions: attempt.total_mcq_questions,
      },
      mock: attempt.mock_exam,
      corrections_released: correctionsReleased,
      theory_grading_pending: theoryGradingPending,
      corrections,
    } })
  } catch (error) {
    return attemptDatabaseError(c, error, 'Could not load your result')
  }
})

import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'

type Variables = { user: any }
type SubjectInput = { name?: unknown; description?: unknown; tutor_ids?: unknown }

export const programmesRouter = new Hono<{ Variables: Variables }>()

programmesRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware)

const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get('user')
  if (profile.role !== 'admin') {
    return c.json({ error: 'Only admins can perform this action', code: 'FORBIDDEN' }, 403)
  }
  await next()
}

const enforceAdminOrTutor = async (c: any, next: any) => {
  const profile = c.get('user')
  if (!['admin', 'tutor'].includes(profile.role)) {
    return c.json({ error: 'Students cannot access curriculum management', code: 'FORBIDDEN' }, 403)
  }
  await next()
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function normaliseSubjects(subjects: SubjectInput[]) {
  return subjects.map((subject, index) => ({
    name: typeof subject.name === 'string' ? subject.name.trim() : '',
    slug: slugify(typeof subject.name === 'string' ? subject.name.trim() : ''),
    description: typeof subject.description === 'string' ? subject.description.trim() : '',
    tutor_ids: Array.isArray(subject.tutor_ids)
      ? [...new Set(subject.tutor_ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [],
    sort_order: index,
  }))
}

async function hasPayoutAccount(schoolId: string) {
  const { data, error } = await supabase.from('paystack_subaccounts')
    .select('subaccount_code').eq('school_id', schoolId).maybeSingle()
  if (error) throw error
  return Boolean(data?.subaccount_code)
}

async function requirePayoutAccount(c: any, schoolId: string) {
  if (await hasPayoutAccount(schoolId)) return null
  return c.json({
    error: 'Add a bank account for payouts before creating a paid programme.',
    code: 'PAYOUT_NOT_CONFIGURED',
  }, 409)
}

async function loadProgrammeSubjects(schoolId: string, programmeId: string) {
  const [{ data: subProgrammes, error: subError }, { data: allCourses, error: courseError }] = await Promise.all([
    supabase.from('sub_programmes').select('id').eq('school_id', schoolId).eq('programme_id', programmeId),
    supabase.from('courses').select('*').eq('school_id', schoolId),
  ])
  if (subError) throw subError
  if (courseError) throw courseError
  const subIds = new Set((subProgrammes || []).map(item => item.id))
  return (allCourses || [])
    .filter(course => course.programme_id === programmeId || (course.sub_programme_id && subIds.has(course.sub_programme_id)))
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
}

// Compatibility create endpoint. New UI uses /setup so a programme cannot be created empty.
programmesRouter.post('/', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    if (!profile.school_id) return c.json({ error: 'Admin has no school setup', code: 'NO_SCHOOL' }, 400)
    const body = await c.req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const slug = slugify(typeof body.slug === 'string' ? body.slug : name)
    if (!name || !slug) return c.json({ error: 'Missing required fields', code: 'BAD_REQUEST' }, 400)

    const price = Number.isFinite(Number(body.price)) ? Math.max(Number(body.price), 0) : 0
    if (price > 0) {
      const payoutError = await requirePayoutAccount(c, profile.school_id)
      if (payoutError) return payoutError
    }

    const { data, error } = await supabase.from('programmes').insert({
      school_id: profile.school_id,
      name,
      slug,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      price,
      currency: body.currency || 'NGN',
      thumbnail_url: null,
      is_published: false,
      created_by: profile.id,
    }).select().single()
    if (error) throw error
    return c.json({ data, message: 'Programme created successfully' }, 201)
  } catch (error: any) {
    const status = error.code === '23505' ? 409 : 500
    return c.json({ error: status === 409 ? 'A programme with this name already exists' : error.message || 'Internal server error', code: status === 409 ? 'SLUG_TAKEN' : undefined }, status)
  }
})

// Atomically creates a draft programme, its subjects, and optional teaching assignments.
programmesRouter.post('/setup', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    if (!profile.school_id) return c.json({ error: 'Admin has no school setup', code: 'NO_SCHOOL' }, 400)
    const body = await c.req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const programmeSlug = slugify(name)
    const subjects = (Array.isArray(body.subjects) ? normaliseSubjects(body.subjects) : [])
      .map(subject => ({ ...subject, slug: slugify(`${programmeSlug}-${subject.name}`) }))
    if (!name) return c.json({ error: 'Programme name is required', code: 'PROGRAMME_NAME_REQUIRED' }, 400)
    if (subjects.length === 0) return c.json({ error: 'Add at least one subject', code: 'SUBJECT_REQUIRED' }, 400)
    if (subjects.some(subject => !subject.name || !subject.slug)) {
      return c.json({ error: 'Every subject needs a name', code: 'SUBJECT_NAME_REQUIRED' }, 400)
    }
    const names = subjects.map(subject => subject.name.toLocaleLowerCase())
    if (new Set(names).size !== names.length) {
      return c.json({ error: 'Subject names must be unique within a programme', code: 'DUPLICATE_SUBJECTS' }, 400)
    }

    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      return c.json({ error: 'Enter a valid programme fee', code: 'INVALID_PRICE' }, 400)
    }
    if (price > 0) {
      const payoutError = await requirePayoutAccount(c, profile.school_id)
      if (payoutError) return payoutError
    }

    const { data, error } = await (supabase as any).rpc('setup_programme', {
      p_school_id: profile.school_id,
      p_created_by: profile.id,
      p_name: name,
      p_slug: programmeSlug,
      p_description: typeof body.description === 'string' ? body.description.trim() : '',
      p_price: price,
      p_currency: body.currency || 'NGN',
      p_subjects: subjects,
    })
    if (error) throw error
    return c.json({ data, message: 'Programme setup saved as a draft' }, 201)
  } catch (error: any) {
    const code = error.message === 'TUTOR_SCHOOL_MISMATCH' ? 'INVALID_TUTOR'
      : error.message === 'DUPLICATE_SUBJECTS' ? 'DUPLICATE_SUBJECTS'
      : error.code === '23505' ? 'SLUG_TAKEN' : 'SETUP_FAILED'
    const status = ['INVALID_TUTOR', 'DUPLICATE_SUBJECTS'].includes(code) ? 400 : code === 'SLUG_TAKEN' ? 409 : 500
    return c.json({ error: code === 'INVALID_TUTOR' ? 'A selected tutor does not belong to this centre' : error.message || 'Programme setup failed', code }, status)
  }
})

programmesRouter.get('/', enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get('user')
    if (!profile.school_id) return c.json({ data: [] })
    const isPublished = c.req.query('is_published')
    let query = supabase.from('programmes').select('*, enrolments(count)').eq('school_id', profile.school_id)
    if (isPublished !== undefined) query = query.eq('is_published', isPublished === 'true')
    const [{ data: programmes, error }, { data: subProgrammes, error: subError }, { data: courses, error: courseError }, { data: assignments, error: assignmentError }] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabase.from('sub_programmes').select('id, programme_id').eq('school_id', profile.school_id),
      supabase.from('courses').select('*').eq('school_id', profile.school_id),
      supabase.from('tutor_course_assignments').select('course_id, tutor_id').eq('school_id', profile.school_id),
    ])
    if (error) throw error
    if (subError) throw subError
    if (courseError) throw courseError
    if (assignmentError) throw assignmentError

    const parentBySub = new Map((subProgrammes || []).map(item => [item.id, item.programme_id]))
    const tutorsByCourse = new Map<string, string[]>()
    for (const assignment of assignments || []) {
      tutorsByCourse.set(assignment.course_id, [...(tutorsByCourse.get(assignment.course_id) || []), assignment.tutor_id])
    }
    const enhanced = (programmes || []).map(programme => {
      const allSubjects = (courses || []).filter(course => course.programme_id === programme.id || parentBySub.get(course.sub_programme_id || '') === programme.id)
        .map((course: any) => ({ ...course, tutor_ids: tutorsByCourse.get(course.id) || [] }))
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
      // A tutor may only receive the subject rows they are assigned to.  The
      // programme remains visible as the class container, but returning its
      // other subjects here would leak learners, materials and assessment
      // context through the class workspace.
      const subjects = profile.role === 'tutor'
        ? allSubjects.filter(subject => subject.tutor_ids.includes(profile.id))
        : allSubjects
      return {
        ...programme,
        courses: subjects,
        courses_count: subjects.length,
        assigned_subjects_count: subjects.filter(subject => subject.tutor_ids.length > 0).length,
        tutors_complete: subjects.length > 0 && subjects.every(subject => subject.tutor_ids.length > 0),
        enrolled_count: programme.enrolments?.[0]?.count || 0,
      }
    })
    return c.json({ data: profile.role === 'tutor'
      ? enhanced.filter(programme => programme.courses.some(subject => subject.tutor_ids.includes(profile.id)))
      : enhanced })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.get('/:id', enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get('user')
    const id = c.req.param('id')
    const { data: programme, error } = await supabase.from('programmes').select('*, enrolments(count)')
      .eq('id', id).eq('school_id', profile.school_id).single()
    if (error || !programme) return c.json({ error: 'Programme not found', code: 'NOT_FOUND' }, 404)
    const subjects = await loadProgrammeSubjects(profile.school_id, id)
    const subjectIds = subjects.map(subject => subject.id)
    let assignments: any[] = []
    if (subjectIds.length > 0) {
      const result = await supabase.from('tutor_course_assignments').select('course_id, tutor_id')
        .eq('school_id', profile.school_id).in('course_id', subjectIds)
      if (result.error) throw result.error
      assignments = result.data || []
    }
    const visibleSubjects = profile.role === 'tutor'
      ? subjects.filter(subject => assignments.some(item => item.course_id === subject.id && item.tutor_id === profile.id))
      : subjects
    if (profile.role === 'tutor' && visibleSubjects.length === 0) {
      return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
    }
    return c.json({ data: {
      ...programme,
      courses: visibleSubjects.map(subject => ({
        ...subject,
        tutor_ids: assignments.filter(item => item.course_id === subject.id).map(item => item.tutor_id),
      })),
      courses_count: visibleSubjects.length,
      enrolled_count: programme.enrolments?.[0]?.count || 0,
    } })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

// Class workspace signals. “Class” is the product name for the existing
// programme model; every query remains scoped through the visible subjects.
programmesRouter.get('/:id/insights', enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get('user')
    const programmeId = c.req.param('id')
    const { data: programme, error: programmeError } = await supabase.from('programmes').select('id')
      .eq('id', programmeId).eq('school_id', profile.school_id).maybeSingle()
    if (programmeError) throw programmeError
    if (!programme) return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)

    const allSubjects = await loadProgrammeSubjects(profile.school_id, programmeId)
    let visibleSubjects = allSubjects
    if (profile.role === 'tutor') {
      const { data: assignments, error } = await supabase.from('tutor_course_assignments').select('course_id')
        .eq('school_id', profile.school_id).eq('tutor_id', profile.id)
      if (error) throw error
      const assigned = new Set((assignments || []).map(item => item.course_id))
      visibleSubjects = allSubjects.filter(subject => assigned.has(subject.id))
    }
    const requestedCourseId = c.req.query('course_id')
    if (requestedCourseId) visibleSubjects = visibleSubjects.filter(subject => subject.id === requestedCourseId)
    const courseIds = visibleSubjects.map(subject => subject.id)
    if (!courseIds.length) return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)

    const [{ data: programmeEnrolments, error: programmeEnrolmentError }, { data: subjectEnrolments, error: subjectEnrolmentError }, { data: courseMocks, error: courseMockError }, { data: programmeMocks, error: programmeMockError }, { data: sessions, error: sessionError }] = await Promise.all([
      supabase.from('enrolments').select('student_id').eq('school_id', profile.school_id).eq('programme_id', programmeId),
      supabase.from('enrolments').select('student_id').eq('school_id', profile.school_id).in('course_id', courseIds),
      supabase.from('mock_exams').select('id, title, course_id').eq('school_id', profile.school_id).in('course_id', courseIds),
      supabase.from('mock_exams').select('id, title, course_id').eq('school_id', profile.school_id).eq('programme_id', programmeId),
      supabase.from('live_classes').select('id, course_id').eq('school_id', profile.school_id).in('course_id', courseIds),
    ])
    if (programmeEnrolmentError || subjectEnrolmentError || courseMockError || programmeMockError || sessionError) throw programmeEnrolmentError || subjectEnrolmentError || courseMockError || programmeMockError || sessionError

    const studentIds = [...new Set([...(programmeEnrolments || []), ...(subjectEnrolments || [])].map(item => item.student_id))]
    const requestedLearnerId = c.req.query('learner_id')
    const scopedStudentIds = requestedLearnerId ? studentIds.filter(id => id === requestedLearnerId) : studentIds
    if (requestedLearnerId && !scopedStudentIds.length) return c.json({ error: 'Learner not found in this class', code: 'NOT_FOUND' }, 404)
    const mockIds = [...new Set([...(courseMocks || []), ...(programmeMocks || [])].map(item => item.id))]
    const sessionIds = (sessions || []).map(item => item.id)
    const [profilesResult, attemptsResult, attendanceResult] = await Promise.all([
      scopedStudentIds.length ? supabase.from('user_profiles').select('id, first_name, last_name').eq('school_id', profile.school_id).in('id', scopedStudentIds) : Promise.resolve({ data: [], error: null }),
      mockIds.length && scopedStudentIds.length ? supabase.from('mock_attempts').select('id, student_id, mock_exam_id, status, submitted_at, total_score, total_marks').eq('school_id', profile.school_id).in('mock_exam_id', mockIds).in('student_id', scopedStudentIds).not('student_id', 'is', null) : Promise.resolve({ data: [], error: null }),
      sessionIds.length && scopedStudentIds.length ? supabase.from('attendance_records').select('student_id, live_class_id, joined_at').eq('school_id', profile.school_id).in('live_class_id', sessionIds).in('student_id', scopedStudentIds) : Promise.resolve({ data: [], error: null }),
    ])
    if (profilesResult.error || attemptsResult.error || attendanceResult.error) throw profilesResult.error || attemptsResult.error || attendanceResult.error

    const attemptsByStudent = new Map<string, any[]>()
    for (const attempt of attemptsResult.data || []) attemptsByStudent.set(attempt.student_id, [...(attemptsByStudent.get(attempt.student_id) || []), attempt])
    const attendanceByStudent = new Map<string, any[]>()
    for (const record of attendanceResult.data || []) attendanceByStudent.set(record.student_id, [...(attendanceByStudent.get(record.student_id) || []), record])
    const learners = (profilesResult.data || []).map((learner: any) => {
      const attempts = (attemptsByStudent.get(learner.id) || []).filter(item => item.status === 'fully_graded' || item.status === 'submitted' || item.status === 'timed_out')
        .sort((a, b) => +new Date(b.submitted_at || 0) - +new Date(a.submitted_at || 0))
      const latest = attempts[0]
      const latestResult = latest?.total_marks ? Math.round((Number(latest.total_score || 0) / Number(latest.total_marks)) * 100) : null
      const attended = (attendanceByStudent.get(learner.id) || []).length
      const attendanceRate = sessionIds.length ? Math.round((attended / sessionIds.length) * 100) : null
      const lastActivity = [latest?.submitted_at, ...(attendanceByStudent.get(learner.id) || []).map(record => record.joined_at)].filter(Boolean).sort().at(-1) || null
      const attention = latestResult !== null && latestResult < 50 ? 'Needs attention'
        : attendanceRate !== null && attendanceRate < 60 ? 'Needs attention'
        : latestResult === null && attended === 0 ? 'No signal yet' : 'On track'
      return { id: learner.id, name: `${learner.first_name || ''} ${learner.last_name || ''}`.trim() || 'Learner', latest_result: latestResult, attended, scheduled_sessions: sessionIds.length, attendance_rate: attendanceRate, last_activity: lastActivity, attention }
    })
    // Topic signals use only marked, versioned answers. Legacy questions and
    // unmarked theory answers are intentionally omitted rather than guessed.
    const attemptIds = (attemptsResult.data || []).map((attempt: any) => attempt.id).filter(Boolean)
    const { data: answers, error: answerError } = attemptIds.length
      ? await supabase.from('mock_answers').select('attempt_id, mock_version_question_id, is_correct, tutor_score')
        .eq('school_id', profile.school_id).in('attempt_id', attemptIds).not('mock_version_question_id', 'is', null)
      : { data: [], error: null }
    if (answerError) throw answerError

    const versionQuestionIds = [...new Set((answers || []).map((answer: any) => answer.mock_version_question_id).filter(Boolean))]
    const { data: versionQuestions, error: versionQuestionError } = versionQuestionIds.length
      ? await supabase.from('mock_version_questions').select('id, question_version_id, section_course_id, marks')
        .eq('school_id', profile.school_id).in('id', versionQuestionIds)
      : { data: [], error: null }
    if (versionQuestionError) throw versionQuestionError

    const questionVersionIds = [...new Set((versionQuestions || []).map((question: any) => question.question_version_id).filter(Boolean))]
    const { data: questionVersions, error: questionVersionError } = questionVersionIds.length
      ? await supabase.from('bank_question_versions').select('id, question_id').eq('school_id', profile.school_id).in('id', questionVersionIds)
      : { data: [], error: null }
    if (questionVersionError) throw questionVersionError

    const questionIds = [...new Set((questionVersions || []).map((version: any) => version.question_id).filter(Boolean))]
    const { data: bankQuestions, error: bankQuestionError } = questionIds.length
      ? await supabase.from('bank_questions').select('id, course_id, topic').eq('school_id', profile.school_id).in('id', questionIds)
      : { data: [], error: null }
    if (bankQuestionError) throw bankQuestionError

    const versionQuestionById = new Map((versionQuestions || []).map((item: any) => [item.id, item]))
    const questionVersionById = new Map((questionVersions || []).map((item: any) => [item.id, item]))
    const bankQuestionById = new Map((bankQuestions || []).map((item: any) => [item.id, item]))
    const topicTotals = new Map<string, { earned: number; available: number; questions: number }>()
    for (const answer of answers || []) {
      const versionQuestion = versionQuestionById.get(answer.mock_version_question_id)
      const questionVersion = versionQuestion && questionVersionById.get(versionQuestion.question_version_id)
      const question = questionVersion && bankQuestionById.get(questionVersion.question_id)
      if (!versionQuestion || !question || !question.topic || !courseIds.includes(question.course_id)) continue
      const marks = Number(versionQuestion.marks || 0)
      const earned = answer.is_correct === true ? marks : Number.isFinite(Number(answer.tutor_score)) ? Number(answer.tutor_score) : answer.is_correct === false ? 0 : null
      if (!marks || earned === null) continue
      const total = topicTotals.get(question.topic) || { earned: 0, available: 0, questions: 0 }
      total.earned += Math.max(0, Math.min(earned, marks))
      total.available += marks
      total.questions += 1
      topicTotals.set(question.topic, total)
    }
    const topics = [...topicTotals.entries()].map(([topic, total]) => {
      const score = Math.round((total.earned / total.available) * 100)
      return { topic, score, questions: total.questions, state: score >= 75 ? 'strong' : score >= 50 ? 'developing' : 'needs_attention' }
    }).sort((a, b) => a.score - b.score || a.topic.localeCompare(b.topic))

    const scored = learners.filter(item => item.latest_result !== null)
    const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + Number(item.latest_result), 0) / scored.length) : null
    const attendance = learners.filter(item => item.attendance_rate !== null)
    const attendanceAverage = attendance.length ? Math.round(attendance.reduce((sum, item) => sum + Number(item.attendance_rate), 0) / attendance.length) : null
    const learner = requestedLearnerId ? learners[0] : null
    const completedAttempts = learner ? (attemptsByStudent.get(learner.id) || [])
      .filter(item => item.status === 'fully_graded' || item.status === 'submitted' || item.status === 'timed_out')
      .sort((a, b) => +new Date(b.submitted_at || 0) - +new Date(a.submitted_at || 0)) : []
    const mockById = new Map([...(courseMocks || []), ...(programmeMocks || [])].map((mock: any) => [mock.id, mock]))
    const scoreFor = (attempt: any) => attempt.total_marks ? Math.round((Number(attempt.total_score || 0) / Number(attempt.total_marks)) * 100) : null
    const latestScore = completedAttempts[0] ? scoreFor(completedAttempts[0]) : null
    const previousScore = completedAttempts[1] ? scoreFor(completedAttempts[1]) : null
    const trend = latestScore === null || previousScore === null ? 'no_signal' : latestScore >= previousScore + 5 ? 'up' : latestScore <= previousScore - 5 ? 'down' : 'steady'
    const weakestTopic = topics[0]
    const learnerDetail = learner ? {
      ...learner,
      previous_score: previousScore,
      trend,
      topics,
      assessments: completedAttempts.slice(0, 5).map((attempt: any) => ({
        id: attempt.id,
        title: mockById.get(attempt.mock_exam_id)?.title || 'Assessment',
        score: scoreFor(attempt),
        submitted_at: attempt.submitted_at || null,
      })),
      insight_summary: weakestTopic && weakestTopic.state === 'needs_attention'
        ? `${learner.name} has marked evidence of difficulty with ${weakestTopic.topic}: ${weakestTopic.score}% across ${weakestTopic.questions} ${weakestTopic.questions === 1 ? 'question' : 'questions'}.`
        : null,
      recommended_action: weakestTopic && weakestTopic.state === 'needs_attention'
        ? `Review ${weakestTopic.topic} in the next session, then use a short follow-up check to confirm understanding.`
        : learner.attendance_rate !== null && learner.attendance_rate < 60
          ? 'Reach out about missed sessions and agree the next catch-up step.'
          : null,
    } : null
    return c.json({ data: { learners, topics, learner_detail: learnerDetail, class_health: { average_assessment_score: average, attendance: attendanceAverage, needs_attention: learners.filter(item => item.attention === 'Needs attention').length } } })
  } catch (error: any) {
    return c.json({ error: error.message || 'Could not load class insights' }, 500)
  }
})

programmesRouter.patch('/:id', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const body = await c.req.json()
    const updates: any = {}
    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim()
      updates.slug = slugify(body.name)
    }
    if (typeof body.description === 'string') updates.description = body.description.trim() || null
    if (body.price !== undefined && Number.isFinite(Number(body.price)) && Number(body.price) >= 0) {
      const price = Number(body.price)
      if (price > 0) {
        const payoutError = await requirePayoutAccount(c, profile.school_id)
        if (payoutError) return payoutError
      }
      updates.price = price
    }
    const { data, error } = await supabase.from('programmes').update(updates)
      .eq('id', c.req.param('id')).eq('school_id', profile.school_id).select().single()
    if (error) throw error
    if (!data) return c.json({ error: 'Programme not found', code: 'NOT_FOUND' }, 404)
    return c.json({ data, message: 'Programme updated successfully' })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.post('/:id/publish', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const id = c.req.param('id')
    const { data: programme } = await supabase.from('programmes').select('id, price').eq('id', id).eq('school_id', profile.school_id).maybeSingle()
    if (!programme) return c.json({ error: 'Programme not found', code: 'NOT_FOUND' }, 404)
    if (Number(programme.price) > 0) {
      const payoutError = await requirePayoutAccount(c, profile.school_id)
      if (payoutError) return payoutError
    }
    const subjects = await loadProgrammeSubjects(profile.school_id, id)
    if (subjects.length === 0) {
      return c.json({ error: 'A programme must have at least one subject before it can be published.', code: 'NO_SUBJECTS_IN_PROGRAMME', readiness: { subject_count: 0, missing_tutors: [] } }, 400)
    }
    const subjectIds = subjects.map(subject => subject.id)
    const { data: assignments, error: assignmentError } = await supabase.from('tutor_course_assignments')
      .select('course_id').eq('school_id', profile.school_id).in('course_id', subjectIds)
    if (assignmentError) throw assignmentError
    const assigned = new Set((assignments || []).map(item => item.course_id))
    const missingTutors = subjects.filter(subject => !assigned.has(subject.id)).map(subject => ({ id: subject.id, name: subject.name }))
    if (missingTutors.length > 0) {
      return c.json({ error: 'Assign at least one tutor to every subject before publishing.', code: 'SUBJECTS_NEED_TUTORS', readiness: { subject_count: subjects.length, missing_tutors: missingTutors } }, 400)
    }
    const { error: subjectError } = await supabase.from('courses').update({ is_published: true })
      .eq('school_id', profile.school_id).in('id', subjectIds)
    if (subjectError) throw subjectError
    const { data, error } = await supabase.from('programmes').update({ is_published: true })
      .eq('id', id).eq('school_id', profile.school_id).select().single()
    if (error) throw error
    return c.json({ message: 'Programme published', data })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.post('/:id/unpublish', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const { data, error } = await supabase.from('programmes').update({ is_published: false })
      .eq('id', c.req.param('id')).eq('school_id', profile.school_id).select().single()
    if (error) throw error
    return c.json({ message: 'Programme unpublished', data })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.delete('/:id', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const id = c.req.param('id')
    const { count, error: countError } = await supabase.from('enrolments').select('*', { count: 'exact', head: true })
      .eq('programme_id', id).eq('school_id', profile.school_id)
    if (countError && countError.code !== '42P01') throw countError
    if (count && count > 0) return c.json({ error: 'Cannot delete programme with active enrolments', code: 'ACTIVE_ENROLMENTS_EXIST' }, 409)
    const { error } = await supabase.from('programmes').delete().eq('id', id).eq('school_id', profile.school_id)
    if (error) throw error
    return c.json({ message: 'Programme deleted' })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

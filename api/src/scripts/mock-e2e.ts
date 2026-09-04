import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const apiUrl = 'http://localhost:3001'
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = 'KanviseE2E9!'
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const webEnv = Object.fromEntries(readFileSync('../web/.env.local', 'utf8').split(/\r?\n/)
  .filter(Boolean).map((line) => line.split(/=(.*)/s)))
const browser = createClient(webEnv.NEXT_PUBLIC_SUPABASE_URL, webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let mockId: string | null = null
let tutorToken = ''

function assertOk(error: any, action: string): void {
  if (error) throw new Error(`${action}: ${error.message}`)
}

async function api(path: string, token: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${method} ${path} (${response.status}): ${json?.error || JSON.stringify(json)}`)
  return json
}

async function createUser(role: 'tutor' | 'student', schoolId: string, schoolSlug: string) {
  const email = `e2e-${role}-${suffix}@example.invalid`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assertOk(authError, `create ${role} auth user`)
  const authId = authData.user!.id
  const userId = `E2E-${role.toUpperCase()}-${suffix}`
  const { data: profile, error: profileError } = await admin.from('user_profiles').insert({
    supabase_auth_id: authId, school_id: schoolId, role, kanvise_user_id: userId,
    first_name: 'E2E', last_name: role, email,
  }).select('id').single()
  assertOk(profileError, `create ${role} profile`)
  if (!profile) throw new Error(`create ${role} profile: no profile returned`)
  const { error: metadataError } = await admin.auth.admin.updateUserById(authId, {
    app_metadata: { role, kanvise_role: role, school_id: schoolId, kanvise_user_id: userId, profile_id: profile.id, e2e_school: schoolSlug },
  })
  assertOk(metadataError, `set ${role} claims`)
  const { data: session, error: signInError } = await browser.auth.signInWithPassword({ email, password })
  assertOk(signInError, `sign in ${role}`)
  return { id: profile.id, token: session.session!.access_token }
}

async function run() {
  const schoolSlug = `e2e-mocks-${suffix}`
  const { data: school, error: schoolError } = await admin.from('schools').insert({ name: `E2E Mocks ${suffix}`, slug: schoolSlug, is_active: false }).select('id').single()
  assertOk(schoolError, 'create test school')
  if (!school) throw new Error('create test school: no school returned')
  const tutor = await createUser('tutor', school.id, schoolSlug)
  const student = await createUser('student', school.id, schoolSlug)
  tutorToken = tutor.token
  const { data: course, error: courseError } = await admin.from('courses').insert({
    school_id: school.id, name: `E2E Mock Course ${suffix}`, slug: `e2e-mock-course-${suffix}`, price: 0, is_published: true, created_by: tutor.id,
  }).select('id').single()
  assertOk(courseError, 'create test course')
  if (!course) throw new Error('create test course: no course returned')
  const { error: assignmentError } = await admin.from('tutor_course_assignments').insert({ school_id: school.id, tutor_id: tutor.id, course_id: course.id, assigned_by: tutor.id })
  assertOk(assignmentError, 'assign tutor to course')
  const { data: payment, error: paymentError } = await admin.from('payments').insert({
    school_id: school.id, student_id: student.id, course_id: course.id, amount: 0, kanvise_fee: 0, centre_amount: 0,
    paystack_reference: `e2e-mock-${suffix}`, status: 'successful', paid_at: new Date().toISOString(),
  }).select('id').single()
  assertOk(paymentError, 'create test payment')
  if (!payment) throw new Error('create test payment: no payment returned')
  const { error: enrolmentError } = await admin.from('enrolments').insert({ school_id: school.id, student_id: student.id, course_id: course.id, payment_id: payment.id })
  assertOk(enrolmentError, 'enrol test student')

  const documentText = readFileSync('../docs/test_mock_exam.txt', 'utf8')
  const imported = await api('/mocks/import/document-text', tutor.token, 'POST', { document_text: documentText, file_name: 'test_mock_exam.txt' })
  // The source paper intentionally has no answer key. The importer preserves
  // that uncertainty rather than guessing, so an E2E tutor review confirms one
  // answer for every unresolved MCQ before the mock can be published.
  let reviewedMcqCount = 0
  const reviewedQuestions = imported.data.questions.map((question: any) => {
    if (question.question_type !== 'mcq' || question.options.filter((option: any) => option.is_correct).length === 1) return question
    reviewedMcqCount += 1
    return { ...question, options: question.options.map((option: any, index: number) => ({ ...option, is_correct: index === 0 })) }
  })
  const created = await api('/mocks', tutor.token, 'POST', {
    title: `E2E Imported Mock ${suffix}`, description: 'Automated end-to-end verification', course_id: course.id,
    distribution_mode: 'centre', time_limit_minutes: 0, max_attempts: 1, result_release_mode: 'score_only',
  })
  mockId = created.data.id
  await api(`/mocks/${mockId}/questions`, tutor.token, 'PUT', { questions: reviewedQuestions })
  const published = await api(`/mocks/${mockId}/publish`, tutor.token, 'POST')
  const studentMocks = await api('/students/me/mocks', student.token)
  if (!studentMocks.data.available.some((mock: any) => mock.id === mockId)) throw new Error('published mock is not visible to its enrolled student')
  const preflight = await api(`/mocks/${mockId}/preflight`, student.token)
  const started = await api(`/mocks/${mockId}/attempts`, student.token, 'POST')
  const attemptId = started.data.attempt_id
  const attempt = await api(`/attempts/${attemptId}`, student.token)
  const firstQuestion = attempt.data.questions[0]
  await api(`/attempts/${attemptId}/answers/${firstQuestion.id}`, student.token, 'PUT', { selected_option_version_id: firstQuestion.options[0].id })
  const submitted = await api(`/attempts/${attemptId}/submit`, student.token, 'POST')
  const results = await api(`/attempts/${attemptId}/results`, student.token)
  await api(`/mocks/${mockId}/archive`, tutor.token, 'POST')
  mockId = null
  console.log(JSON.stringify({ importedQuestions: imported.data.questions.length, reviewedMcqCount, publishedVersion: published.version?.id || null, preflightQuestions: preflight.data.version.total_questions, attemptId, submissionStatus: submitted.data.status, resultStatus: results.data.attempt.status, archived: true }))
}

run().catch(async (error) => {
  if (mockId && tutorToken) await api(`/mocks/${mockId}/archive`, tutorToken, 'POST').catch(() => undefined)
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

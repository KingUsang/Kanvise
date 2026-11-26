import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const h = vi.hoisted(() => ({ db: null as any, user: { id: 'tutor-1', role: 'tutor', school_id: 'school-1' } as any }))

vi.mock('../lib/supabase', async () => {
  const { createFakeDb, createFakeSupabase } = await import('../test/fake-supabase')
  h.db = createFakeDb()
  return { supabase: createFakeSupabase(h.db) }
})
vi.mock('../notifications/triggers', () => ({ notifyMockFullyGraded: vi.fn(async () => ({ failures: [] })) }))
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', h.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', { id: h.user.school_id, role: h.user.role }); await next() },
}))
vi.mock('../middleware/account-projection', () => ({
  accountUserProjection: async (_c: any, next: () => Promise<void>) => next(),
}))

import { mockAnswersRouter } from './mock-answers'

const app = new Hono()
app.route('/mock-answers', mockAnswersRouter)

const grade = () => app.request('/mock-answers/ans-1/grade', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tutor_score: 2 }),
})

const answer = (tutorId: string) => ({
  id: 'ans-1', school_id: 'school-1',
  question: { id: 'q1', marks: 5, version: { question: { question_type: 'theory' } } },
  attempt: { id: 'att-1', student_id: 's1', status: 'submitted', mcq_score: 0, mock_exam_id: 'm1', mock_exam_version_id: 'v1', mock_exam: { id: 'm1', title: 'T', tutor_id: tutorId, course_id: 'course-1' } },
})

beforeEach(() => {
  h.user = { id: 'tutor-1', role: 'tutor', school_id: 'school-1' }
  h.db.tables = {}
  h.db.calls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('theory grading authorization (DEV-QUIZ-033)', () => {
  it('rejects a Tutor who is assigned to the Subject but does not own the Quiz', async () => {
    h.db.tables['mock_answers:select'] = { data: answer('someone-else') }
    h.db.tables['tutor_course_assignments'] = { data: { id: 'a1' } }
    const res = await grade()
    expect(res.status).toBe(403)
    expect(h.db.calls.filter(call => call.op === 'update')).toHaveLength(0)
  })

  it('rejects an owner who is no longer assigned to the Subject', async () => {
    h.db.tables['mock_answers:select'] = { data: answer('tutor-1') }
    h.db.tables['tutor_course_assignments'] = { data: null }
    expect((await grade()).status).toBe(403)
  })

  it('reports an assignment lookup failure as a server error, not a permission denial', async () => {
    h.db.tables['mock_answers:select'] = { data: answer('tutor-1') }
    h.db.tables['tutor_course_assignments'] = { data: null, error: { message: 'db down' } }
    const res = await grade()
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: 'DATABASE_ERROR' })
  })

  it('lets an admin grade any Quiz in the account', async () => {
    h.user = { id: 'admin-1', role: 'admin', school_id: 'school-1' }
    h.db.tables['mock_answers:select'] = { data: answer('someone-else') }
    h.db.tables['mock_answers:update'] = { data: { id: 'ans-1', tutor_score: 2 } }
    h.db.tables['mock_attempt_questions'] = { data: [{ mock_version_question_id: 'q1' }] }
    h.db.tables['mock_version_questions'] = { data: [{ id: 'q1', version: { question: { question_type: 'theory' } } }] }
    h.db.tables['mock_answers'] = { data: [] }
    const res = await grade()
    expect(res.status).toBe(200)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ db: null as any, user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any }))

vi.mock('../lib/supabase', async () => {
  const { createFakeDb, createFakeSupabase } = await import('../test/fake-supabase')
  h.db = createFakeDb()
  return { supabase: createFakeSupabase(h.db) }
})
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn(async () => 'signed-url') }))
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', h.user); await next() },
}))
vi.mock('../middleware/account-projection', () => ({
  standaloneAwareAccountContext: async (_c: any, next: () => Promise<void>) => next(),
  standaloneAwareAccountProjection: async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../lib/student-mock-audience', () => ({
  loadStudentMockAudience: async () => ({ courseIds: ['course-1'], programmeIds: [] }),
  studentCanAccessCentreMock: () => true,
}))

import { studentMocksRouter } from './student-mocks'

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const past = new Date(Date.now() - 60_000).toISOString()
const future = new Date(Date.now() + 3_600_000).toISOString()

beforeEach(() => {
  h.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
  h.db.tables = {}
  h.db.rpc = {}
  h.db.calls.length = 0
  h.db.rpcCalls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('learner Quiz list reads do not write (DEV-QUIZ-006, DEV-QUIZ-025)', () => {
  it('shows expired attempts as timed out without finalizing them', async () => {
    h.db.tables['mock_exams'] = { data: [{ id: 'mock-1', title: 'Q', max_attempts: 1, available_from: null, closes_at: null, versions: [{ id: 'v1', version_number: 1, total_questions: 2, total_marks: 2 }] }] }
    h.db.tables['mock_attempts'] = { data: [
      { id: 'a1', mock_exam_id: 'mock-1', mock_exam_version_id: 'v1', attempt_number: 1, status: 'in_progress', deadline_at: past },
      { id: 'a2', mock_exam_id: 'mock-1', mock_exam_version_id: 'v1', attempt_number: 2, status: 'in_progress', deadline_at: past },
    ] }
    h.db.tables['mock_attempt_grants'] = { data: [] }
    const res = await studentMocksRouter.request('/students/me/mocks')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(h.db.rpcCalls).toHaveLength(0)
    expect(body.data.in_progress).toHaveLength(0)
    expect(body.data.completed).toHaveLength(1)
    expect(body.data.completed[0].attempt.status).toBe('timed_out')
  })

  it('keeps a live attempt resumable', async () => {
    h.db.tables['mock_exams'] = { data: [{ id: 'mock-1', title: 'Q', max_attempts: 1, versions: [{ id: 'v1', version_number: 1, total_questions: 2, total_marks: 2 }] }] }
    h.db.tables['mock_attempts'] = { data: [{ id: 'a1', mock_exam_version_id: 'v1', attempt_number: 1, status: 'in_progress', deadline_at: future }] }
    h.db.tables['mock_attempt_grants'] = { data: [] }
    const body = await (await studentMocksRouter.request('/students/me/mocks')).json()
    expect(body.data.in_progress).toHaveLength(1)
  })
})

describe('submission success after commit (DEV-QUIZ-007)', () => {
  it('does not return 500 when the post-submit reload fails', async () => {
    h.db.tables['mock_attempts'] = (() => {
      let reads = 0
      return () => (++reads === 1 ? { data: { school_id: 'school-1' } } : { data: null, error: { message: 'connection reset' } })
    })()
    h.db.rpc['submit_versioned_mock_attempt'] = { data: [{ status: 'submitted' }] }
    const res = await studentMocksRouter.request('/attempts/a1/submit', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('submitted')
    expect(body.warnings).toContain('ATTEMPT_RELOAD_FAILED')
  })

  it('returns the reloaded totals when the reload works', async () => {
    h.db.tables['mock_attempts'] = { data: { school_id: 'school-1', status: 'submitted', total_score: 3, total_marks: 4 } }
    h.db.rpc['submit_versioned_mock_attempt'] = { data: [{ status: 'submitted' }] }
    const body = await (await studentMocksRouter.request('/attempts/a1/submit', { method: 'POST' })).json()
    expect(body.data).toMatchObject({ total_score: 3, total_marks: 4 })
    expect(body.warnings).toBeUndefined()
  })
})

describe('flag update never rewrites the answer (DEV-QUIZ-026)', () => {
  const attemptRow = { school_id: 'school-1', status: 'in_progress', deadline_at: future }

  it('updates only is_flagged when an answer exists', async () => {
    h.db.tables['mock_attempts'] = { data: attemptRow }
    h.db.tables['mock_answers:update'] = { data: [{ id: 'ans-1' }] }
    const res = await studentMocksRouter.request('/attempts/a1/questions/q1/flag', { method: 'PATCH', ...json({ is_flagged: true }) })
    expect(res.status).toBe(200)
    expect(h.db.rpcCalls).toHaveLength(0)
    const update = h.db.calls.find(call => call.table === 'mock_answers' && call.op === 'update')
    expect(update?.payload).toEqual({ is_flagged: true })
  })

  it('creates a flag-only row through the validating function when no answer exists', async () => {
    h.db.tables['mock_attempts'] = { data: attemptRow }
    h.db.tables['mock_answers:update'] = { data: [] }
    h.db.rpc['save_versioned_mock_answer'] = { data: [{ answer_id: 'ans-2' }] }
    const res = await studentMocksRouter.request('/attempts/a1/questions/q1/flag', { method: 'PATCH', ...json({ is_flagged: true }) })
    expect(res.status).toBe(200)
    expect(h.db.rpcCalls[0].args).toMatchObject({ p_selected_option_version_id: null, p_theory_answer_text: null, p_is_flagged: true })
  })

  it('refuses a finalized or expired attempt', async () => {
    h.db.tables['mock_attempts'] = { data: { ...attemptRow, status: 'submitted' } }
    expect((await studentMocksRouter.request('/attempts/a1/questions/q1/flag', { method: 'PATCH', ...json({ is_flagged: true }) })).status).toBe(409)
    h.db.tables['mock_attempts'] = { data: { ...attemptRow, deadline_at: past } }
    expect((await studentMocksRouter.request('/attempts/a1/questions/q1/flag', { method: 'PATCH', ...json({ is_flagged: true }) })).status).toBe(409)
    expect(h.db.calls.filter(call => call.op === 'update')).toHaveLength(0)
  })
})

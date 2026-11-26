import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const h = vi.hoisted(() => ({ db: null as any, user: { id: 'tutor-1', role: 'tutor', school_id: 'school-1' } as any }))

vi.mock('../lib/supabase', async () => {
  const { createFakeDb, createFakeSupabase } = await import('../test/fake-supabase')
  h.db = createFakeDb()
  return { supabase: createFakeSupabase(h.db) }
})
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn(), verifyPrivateUpload: vi.fn() }))
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', h.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', { id: h.user.school_id, role: h.user.role }); await next() },
}))
vi.mock('../middleware/account-projection', () => ({
  accountUserProjection: async (_c: any, next: () => Promise<void>) => next(),
}))

import { questionBanksRouter } from './question-banks'

const app = new Hono()
app.route('/question-banks', questionBanksRouter)

const QUESTION = '11111111-1111-4111-8111-111111111111'
const BANK = '22222222-2222-4222-8222-222222222222'
const COURSE = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  h.user = { id: 'tutor-1', role: 'tutor', school_id: 'school-1' }
  h.db.tables = {}
  h.db.rpc = {}
  h.db.calls.length = 0
  h.db.rpcCalls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('Question version history lookup (DEV-QBK-008)', () => {
  it('reports a failed question lookup as a server error, not not-found', async () => {
    h.db.tables['bank_questions'] = { data: null, error: { message: 'connection reset' } }
    const res = await app.request(`/question-banks/questions/${QUESTION}/versions`)
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: 'DATABASE_ERROR' })
  })

  it('still answers 404 when the question genuinely does not exist', async () => {
    h.db.tables['bank_questions'] = { data: null }
    const res = await app.request(`/question-banks/questions/${QUESTION}/versions`)
    expect(res.status).toBe(404)
  })
})

describe('Subject assignment lookup (DEV-QBK-001)', () => {
  const revise = () => app.request(`/question-banks/questions/${QUESTION}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plain_text: 'Updated', marks: 1, course_id: COURSE, content_blocks: [], options: [] }),
  })
  const owned = { data: { id: QUESTION, school_id: 'school-1', author_id: 'tutor-1', question_type: 'theory', archived_at: null } }

  it('reports a failed assignment query as a server error instead of a permission denial', async () => {
    h.db.tables['bank_questions'] = owned
    h.db.tables['tutor_course_assignments'] = { data: null, error: { message: 'db down' } }
    const res = await revise()
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: 'DATABASE_ERROR' })
    expect(h.db.rpcCalls).toHaveLength(0)
  })

  it('answers 403 when the Tutor is genuinely not assigned', async () => {
    h.db.tables['bank_questions'] = owned
    h.db.tables['tutor_course_assignments'] = { data: null }
    const res = await revise()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ code: 'NOT_ASSIGNED_TO_COURSE' })
  })
})

describe('Bank capability contract (DEV-QBK-005)', () => {
  const bank = (over: Record<string, unknown>) => ({ id: 'b1', school_id: 'school-1', owner_id: 'other', visibility: 'private', archived_at: null, questions: [{ count: 0 }], ...over })

  it('tells the UI which banks the tutor can add questions to', async () => {
    h.db.tables['question_banks'] = { data: [bank({ owner_id: 'tutor-1' }), bank({ id: 'b2', visibility: 'centre' })], count: 2 }
    const res = await app.request('/question-banks')
    const body = await res.json()
    expect(body.data[0]).toMatchObject({ can_edit: true, can_contribute: true })
    expect(body.data[1]).toMatchObject({ can_edit: false, can_contribute: true })
  })
})

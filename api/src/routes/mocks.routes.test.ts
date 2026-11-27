import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const h = vi.hoisted(() => ({ db: null as any, user: { id: 'tutor-1', role: 'tutor', school_id: 'school-1' } as any }))

vi.mock('../lib/supabase', async () => {
  const { createFakeDb, createFakeSupabase } = await import('../test/fake-supabase')
  h.db = createFakeDb()
  return { supabase: createFakeSupabase(h.db) }
})
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn(async () => 'signed-url') }))
vi.mock('../notifications/triggers', () => ({ notifyMockPublished: vi.fn(async () => ({ failures: [] })) }))
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', h.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', { id: h.user.school_id, role: h.user.role }); await next() },
}))
vi.mock('../middleware/account-projection', () => ({
  accountUserProjection: async (_c: any, next: () => Promise<void>) => next(),
}))

import { mocksRouter } from './mocks'

const app = new Hono()
app.route('/mocks', mocksRouter)

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const draftMock = { id: 'mock-1', status: 'draft', course_id: 'course-1', programme_id: null, audience_scope: 'course', tutor_id: 'tutor-1', time_limit_minutes: 30 }

beforeEach(() => {
  h.user = { id: 'tutor-1', role: 'tutor', school_id: 'school-1' }
  h.db.tables = {}
  h.db.rpc = {}
  h.db.calls.length = 0
  h.db.rpcCalls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('retired Quiz distribution on the authoring routes', () => {
  it('rejects creating a direct-link (standalone) Quiz', async () => {
    const res = await app.request('/mocks', { method: 'POST', ...json({ title: 'Standalone', audience_scope: 'direct_link' }) })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ code: 'INVALID_AUDIENCE' })
    expect(h.db.calls.filter(call => call.table === 'mock_exams' && call.op === 'insert')).toHaveLength(0)
  })

  it('never stores share-link, price or slug settings on a new Quiz', async () => {
    h.db.tables['tutor_course_assignments'] = { data: [{ id: 'a' }] }
    h.db.tables['mock_exams:insert'] = { data: { id: 'mock-1' } }
    const res = await app.request('/mocks', { method: 'POST', ...json({
      title: 'Class quiz', audience_scope: 'course', course_id: 'course-1',
      direct_link_enabled: true, direct_link_access_mode: 'paid', direct_link_price_kobo: 5000, direct_link_slug: 'buy-me',
    }) })
    const insert = h.db.calls.find(call => call.table === 'mock_exams' && call.op === 'insert')
    expect(res.status).toBe(201)
    expect(insert!.payload[0]).toMatchObject({ direct_link_enabled: false, direct_link_access_mode: 'free_claim', direct_link_price_kobo: 0, direct_link_slug: null })
  })

  it('refuses to publish a legacy direct-link draft', async () => {
    h.db.tables['mock_exams'] = { data: { ...draftMock, audience_scope: 'direct_link' } }
    const res = await app.request('/mocks/mock-1/publish', { method: 'POST' })
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ code: 'QUIZ_AUDIENCE_RETIRED' })
    expect(h.db.rpcCalls).toHaveLength(0)
  })
})

describe('legacy direct question writes (DEV-QUIZ-022, DEV-QUIZ-023)', () => {
  it('disables POST /mocks/:id/questions and writes nothing', async () => {
    h.db.tables['mock_exams'] = { data: draftMock }
    const res = await app.request('/mocks/mock-1/questions', { method: 'POST', ...json({
      question_type: 'mcq', question_text: 'Q', options: [{ option_text: 'A', is_correct: true }],
    }) })
    expect(res.status).toBe(410)
    await expect(res.json()).resolves.toMatchObject({ code: 'LEGACY_QUESTION_WRITE_DISABLED' })
    expect(h.db.calls).toHaveLength(0)
  })
})

describe('publication success after commit (DEV-QUIZ-024)', () => {
  const publishable = () => {
    h.db.tables['mock_exams:select'] = { data: draftMock }
    h.db.tables['tutor_course_assignments'] = { data: [{ id: 'a' }] }
    h.db.tables['mock_sections'] = { count: 1, data: [] }
    h.db.rpc['publish_versioned_mock_with_offer'] = { data: [{ version_id: 'v1' }] }
  }

  it('creates no direct offer when publishing', async () => {
    publishable()
    await app.request('/mocks/mock-1/publish', { method: 'POST' })
    expect(h.db.rpcCalls[0].args).toMatchObject({ p_create_direct_offer: false, p_direct_price_kobo: 0, p_direct_access_mode: 'free_claim' })
  })

  it('returns the committed identity when the reload fails', async () => {
    publishable()
    let reads = 0
    h.db.tables['mock_exams:select'] = () => (++reads === 1 ? { data: draftMock } : { data: null, error: { message: 'connection reset' } })
    const res = await app.request('/mocks/mock-1/publish', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: 'mock-1', status: 'published' })
    expect(body.warnings).toContain('PUBLISHED_BUT_RELOAD_FAILED')
  })

  it('returns success with a warning when notifications throw', async () => {
    publishable()
    let reads = 0
    h.db.tables['mock_exams:select'] = () => (++reads === 1 ? { data: draftMock } : { data: { ...draftMock, status: 'published', school_id: 'school-1', title: 'T' } })
    const { notifyMockPublished } = await import('../notifications/triggers')
    vi.mocked(notifyMockPublished).mockRejectedValueOnce(new Error('push down'))
    const res = await app.request('/mocks/mock-1/publish', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warnings).toContain('NOTIFICATION_FAILED')
    expect(h.db.calls.some(call => call.op === 'update' && call.payload?.notification_sent === true)).toBe(false)
  })
})

describe('grading count (DEV-QUIZ-034)', () => {
  it('reports a failed assignment lookup instead of zero', async () => {
    h.db.tables['tutor_course_assignments'] = { data: null, error: { message: 'db down' } }
    const res = await app.request('/mocks/ungraded-count')
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: 'GRADING_COUNT_UNAVAILABLE' })
  })

  it('reports a failed Quiz lookup instead of zero', async () => {
    h.db.tables['tutor_course_assignments'] = { data: [{ course_id: 'course-1' }] }
    h.db.tables['mock_exams'] = { data: null, error: { message: 'db down' } }
    const res = await app.request('/mocks/ungraded-count')
    expect(res.status).toBe(500)
  })

  it('returns zero only when the Tutor genuinely has no assignments', async () => {
    h.db.tables['tutor_course_assignments'] = { data: [] }
    const res = await app.request('/mocks/ungraded-count')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { count: 0 } })
  })
})

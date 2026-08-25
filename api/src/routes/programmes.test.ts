import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { programmesRouter } from './programmes'

function query(result: any, onUpdate?: (value: any) => void) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn((value) => { onUpdate?.(value); return builder }),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

function post(path: string, body: unknown) {
  return programmesRouter.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('programme setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    mocks.rpc.mockResolvedValue({ data: { programme: { id: 'programme-1', is_published: false }, courses: [{ id: 'course-1', is_published: false }] }, error: null })
  })

  it('is admin-only', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    const response = await post('/setup', { name: 'JAMB Chemistry', price: 0, subjects: [{ name: 'Chemistry' }] })
    expect(response.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('requires at least one subject', async () => {
    const response = await post('/setup', { name: 'JAMB Chemistry', price: 0, subjects: [] })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'SUBJECT_REQUIRED' })
  })

  it('rejects duplicate subject names before starting the transaction', async () => {
    const response = await post('/setup', { name: 'JAMB', price: 1000, subjects: [{ name: 'Chemistry' }, { name: ' chemistry ' }] })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'DUPLICATE_SUBJECTS' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('passes tenant identity, generated slugs, tutor ids, and unpublished-only input to the transaction', async () => {
    const response = await post('/setup', { name: 'JAMB Chemistry', price: 15000, is_published: true, subjects: [{ name: 'Organic Chemistry', tutor_ids: ['tutor-1'] }] })
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('setup_programme', expect.objectContaining({
      p_school_id: 'school-1', p_created_by: 'admin-1', p_slug: 'jamb-chemistry',
      p_subjects: [expect.objectContaining({ slug: 'jamb-chemistry-organic-chemistry', tutor_ids: ['tutor-1'] })],
    }))
    expect(JSON.stringify(mocks.rpc.mock.calls[0][1])).not.toContain('is_published')
  })

  it('returns a tenant-safe error when a tutor is outside the centre', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'TUTOR_SCHOOL_MISMATCH', code: '42501' } })
    const response = await post('/setup', { name: 'JAMB', price: 0, subjects: [{ name: 'Chemistry', tutor_ids: ['other-tutor'] }] })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_TUTOR' })
  })
})

describe('programme publishing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('finds subjects stored below legacy sub-programmes and identifies missing tutors', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'programme-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [{ id: 'legacy-sub', programme_id: 'programme-1' }], error: null })
      if (table === 'courses') return query({ data: [{ id: 'nested-subject', name: 'Chemistry', programme_id: null, sub_programme_id: 'legacy-sub', sort_order: 0 }], error: null })
      if (table === 'tutor_course_assignments') return query({ data: [], error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await post('/programme-1/publish', {})
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'SUBJECTS_NEED_TUTORS', readiness: { missing_tutors: [{ id: 'nested-subject', name: 'Chemistry' }] } })
  })

  it('publishes every included subject before publishing the programme', async () => {
    const updateOrder: string[] = []
    let programmeCalls = 0
    let courseCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') {
        programmeCalls += 1
        return programmeCalls === 1
          ? query({ data: { id: 'programme-1' }, error: null })
          : query({ data: { id: 'programme-1', is_published: true }, error: null }, () => updateOrder.push('programme'))
      }
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') {
        courseCalls += 1
        return courseCalls === 1
          ? query({ data: [{ id: 'subject-1', name: 'Chemistry', programme_id: 'programme-1', sub_programme_id: null }], error: null })
          : query({ data: null, error: null }, () => updateOrder.push('subjects'))
      }
      if (table === 'tutor_course_assignments') return query({ data: [{ course_id: 'subject-1' }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await post('/programme-1/publish', {})
    expect(response.status).toBe(200)
    expect(updateOrder).toEqual(['subjects', 'programme'])
  })

  it('does not allow ordinary PATCH to bypass publishing readiness', async () => {
    let updates: any
    mocks.from.mockReturnValue(query({ data: { id: 'programme-1', is_published: false }, error: null }, value => { updates = value }))
    const response = await programmesRouter.request('/programme-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Updated', is_published: true }) })
    expect(response.status).toBe(200)
    expect(updates).toEqual({ name: 'Updated', slug: 'updated' })
  })
})

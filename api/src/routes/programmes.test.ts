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
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', { id: 'school-1', membershipId: 'membership-1', role: mocks.user.role === 'student' ? 'learner' : mocks.user.role })
    await next()
  },
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
    not: vi.fn(() => builder),
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
    mocks.from.mockImplementation((table: string) => {
      if (table === 'paystack_subaccounts') return query({ data: { subaccount_code: 'ACCT_TEST' }, error: null })
      throw new Error(`Unexpected table ${table}`)
    })
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
    const response = await programmesRouter.request('/setup', { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'c62ed60d-47cb-4d9a-9797-fbc390488f98' }, body: JSON.stringify({ name: 'JAMB Chemistry', price: 15000, is_published: true, subjects: [{ name: 'Organic Chemistry', tutor_ids: ['11111111-1111-4111-8111-111111111111'] }] }) })
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('setup_programme', expect.objectContaining({
      p_school_id: 'school-1', p_created_by: 'admin-1', p_slug: 'jamb-chemistry',
      p_creation_key: 'c62ed60d-47cb-4d9a-9797-fbc390488f98',
      p_subjects: [expect.objectContaining({ slug: 'jamb-chemistry-organic-chemistry', tutor_ids: ['11111111-1111-4111-8111-111111111111'] })],
    }))
    expect(JSON.stringify(mocks.rpc.mock.calls[0][1])).not.toContain('is_published')
  })

  it('returns a recovered class for a repeated idempotent setup', async () => {
    mocks.rpc.mockResolvedValue({ data: { programme: { id: 'programme-1' }, courses: [], replayed: true }, error: null })
    const response = await programmesRouter.request('/setup', { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'c62ed60d-47cb-4d9a-9797-fbc390488f98' }, body: JSON.stringify({ name: 'JAMB Chemistry', price: 0, subjects: [{ name: 'Chemistry' }] }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { programme: { id: 'programme-1' }, replayed: true } })
  })

  it('returns a tenant-safe error when a tutor is outside the centre', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'TUTOR_SCHOOL_MISMATCH', code: '42501' } })
    const response = await post('/setup', { name: 'JAMB', price: 0, subjects: [{ name: 'Chemistry', tutor_ids: ['22222222-2222-4222-8222-222222222222'] }] })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_TUTOR' })
  })

  it('rejects malformed tutor_ids before starting setup', async () => {
    const response = await post('/setup', { name: 'JAMB', price: 0, subjects: [{ name: 'Chemistry', tutor_ids: ['not-a-uuid'] }] })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_TUTOR_IDS' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('requires a payout account before creating a paid programme', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'paystack_subaccounts') return query({ data: null, error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await post('/setup', { name: 'JAMB', price: 1000, subjects: [{ name: 'Chemistry' }] })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PAYOUT_NOT_CONFIGURED' })
    expect(mocks.rpc).not.toHaveBeenCalled()
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

  it('requires a payout account before publishing a paid programme', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'programme-1', price: 1000 }, error: null })
      if (table === 'paystack_subaccounts') return query({ data: null, error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await post('/programme-1/publish', {})
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PAYOUT_NOT_CONFIGURED' })
  })

  it('does not allow ordinary PATCH to bypass publishing readiness', async () => {
    let updates: any
    mocks.from.mockReturnValue(query({ data: { id: 'programme-1', is_published: false }, error: null }, value => { updates = value }))
    const response = await programmesRouter.request('/programme-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Updated', is_published: true }) })
    expect(response.status).toBe(200)
    expect(updates).toEqual({ name: 'Updated', slug: 'updated' })
  })
})

describe('class insights authorization scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
  })

  it('does not include programme-only learners or programme-level assessments for a Tutor', async () => {
    let enrolmentCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'programme-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [
        { id: 'subject-1', name: 'Physics', programme_id: 'programme-1', sub_programme_id: null },
        { id: 'subject-2', name: 'Chemistry', programme_id: 'programme-1', sub_programme_id: null },
      ], error: null })
      if (table === 'tutor_course_assignments') return query({ data: [{ course_id: 'subject-1' }], error: null })
      if (table === 'enrolments') {
        enrolmentCalls += 1
        return query({ data: [{ student_id: enrolmentCalls === 1 ? 'programme-learner' : 'subject-learner' }], error: null })
      }
      if (table === 'mock_exams') return query({ data: [{ id: 'subject-assessment', title: 'Physics quiz', course_id: 'subject-1' }], error: null })
      if (table === 'live_classes') return query({ data: [{ id: 'session-1', course_id: 'subject-1' }], error: null })
      if (table === 'user_profiles') return query({ data: [{ id: 'subject-learner', first_name: 'Subject', last_name: 'Learner' }], error: null })
      if (table === 'mock_attempts' || table === 'attendance_records') return query({ data: [], error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await programmesRouter.request('/programme-1/insights')
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data.learners).toEqual([expect.objectContaining({ id: 'subject-learner' })])
    expect(body.data.learners).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'programme-learner' })]))
    expect(enrolmentCalls).toBe(2)
  })
})

describe('programme list filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('rejects malformed publication filters before querying', async () => {
    const response = await programmesRouter.request('/?is_published=published')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('retains false publication filtering for valid callers', async () => {
    const calls: Array<[string, ...any[]]> = []
    const builder: any = {
      select: (...args: any[]) => { calls.push(['select', ...args]); return builder },
      eq: (...args: any[]) => { calls.push(['eq', ...args]); return builder },
      order: (...args: any[]) => { calls.push(['order', ...args]); return builder },
      then: (resolve: (value: any) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
    }
    mocks.from.mockImplementation((table: string) => table === 'programmes'
      ? builder
      : {
          select: () => ({ eq: () => ({ then: (resolve: (value: any) => void) => Promise.resolve({ data: [], error: null }).then(resolve) }) }),
        })
    const response = await programmesRouter.request('/?is_published=false')
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['eq', 'is_published', false])
  })
})

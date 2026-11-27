import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' } as any,
  account: { id: 'school-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (mocks.account) c.set('account', mocks.account)
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Insufficient role', code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { classesRouter } from './classes'

function query(result: any) {
  const value: any = {
    select: () => value, eq: () => value, in: () => value, is: () => value,
    gte: () => value, lte: () => value, order: () => value, or: () => value, limit: () => value, range: () => value,
    maybeSingle: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('class-first API aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'admin' }
  })

  it('requires the verified active account context before class access', async () => {
    mocks.account = null

    const response = await classesRouter.request('/class-1/subjects', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Physics' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('adds a subject atomically for an admin and keeps tenant identity in the RPC', async () => {
    mocks.user = { id: 'admin-1', school_id: 'legacy-school', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'class-1', name: 'JAMB 2027', is_published: false }, error: null })
      if (table === 'schools') return query({ data: { account_type: 'centre' }, error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.rpc.mockResolvedValue({ data: { subject: { id: 'physics', name: 'Physics' }, tutor_ids: ['tutor-1'] }, error: null })

    const response = await classesRouter.request('/class-1/subjects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Physics', tutor_ids: ['11111111-1111-4111-8111-111111111111'] }),
    })

    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('add_programme_subject', expect.objectContaining({
      p_school_id: 'account-1', p_created_by: 'admin-1', p_programme_id: 'class-1',
      p_slug: 'jamb-2027-physics', p_tutor_ids: ['11111111-1111-4111-8111-111111111111'],
    }))
  })

  it('rejects ordinary tutors before subject creation', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'tutor' }
    const response = await classesRouter.request('/class-1/subjects', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Physics' }),
    })
    expect(response.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects malformed tutor_ids before class or RPC lookups', async () => {
    const response = await classesRouter.request('/class-1/subjects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Physics', tutor_ids: ['not-a-uuid'] }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_TUTOR_IDS' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('serves the cross-class recurring timetable without invoking a legacy programme route', async () => {
    mocks.from.mockReturnValue(query({ data: [{ id: 'slot-1', weekday: 1, course_id: 'physics' }], error: null }))

    const response = await classesRouter.request('/timetable')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: 'slot-1', weekday: 1, course_id: 'physics' }], pagination: { page: 1, page_size: 100, has_more: false } })
    expect(mocks.from).toHaveBeenCalledWith('class_timetable_slots')
    expect(mocks.from).not.toHaveBeenCalledWith('programmes')
  })

  it('bounds the timetable with validated pagination and reports more pages', async () => {
    const range = vi.fn()
    const q = query({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    q.range = (from: number, to: number) => { range(from, to); return q }
    mocks.from.mockReturnValue(q)

    const response = await classesRouter.request('/timetable?page=2&page_size=2')

    expect(response.status).toBe(200)
    expect(range).toHaveBeenCalledWith(2, 3)
    expect((await response.json() as any).pagination).toEqual({ page: 2, page_size: 2, has_more: true })
  })

  it('rejects invalid timetable pagination and filters', async () => {
    expect((await classesRouter.request('/timetable?page_size=1000')).status).toBe(400)
    expect((await classesRouter.request('/timetable?page=0')).status).toBe(400)
    expect((await classesRouter.request('/timetable?tutor_id=not-a-uuid')).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not expose centre-wide timetable to a tutor', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'tutor' }

    const response = await classesRouter.request('/timetable')

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not expose a centre-wide timetable to an independent tutor account', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'schools') return query({ data: { account_type: 'independent' }, error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/timetable')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'CENTRE_TIMETABLE_UNAVAILABLE' })
    expect(mocks.from).toHaveBeenCalledWith('schools')
    expect(mocks.from).not.toHaveBeenCalledWith('class_timetable_slots')
  })

  it('returns a class-scoped read model of sessions and recurring slots', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'class-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [{ id: '00000000-0000-4000-8000-000000000a01', name: 'Physics', programme_id: 'class-1' }], error: null })
      if (table === 'live_classes') return query({ data: [{ id: 'session-1', course_id: '00000000-0000-4000-8000-000000000a01' }], error: null })
      if (table === 'class_timetable_slots') return query({ data: [{ id: 'slot-1', course_id: '00000000-0000-4000-8000-000000000a01', weekday: 1 }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/00000000-0000-4000-8000-0000000000c1/schedule?course_id=00000000-0000-4000-8000-000000000a01')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        subjects: [{ id: '00000000-0000-4000-8000-000000000a01', name: 'Physics', programme_id: 'class-1' }],
        sessions: [{ id: 'session-1', course_id: '00000000-0000-4000-8000-000000000a01' }],
        recurring_slots: [{ id: 'slot-1', course_id: '00000000-0000-4000-8000-000000000a01', weekday: 1 }],
      },
    })
  })

  it('limits a tutor schedule read to subjects assigned to that tutor', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'tutor' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'class-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [
        { id: '00000000-0000-4000-8000-000000000a01', name: 'Physics', programme_id: 'class-1' },
        { id: '00000000-0000-4000-8000-000000000a02', name: 'Chemistry', programme_id: 'class-1' },
      ], error: null })
      if (table === 'tutor_course_assignments') return query({ data: [{ course_id: '00000000-0000-4000-8000-000000000a01' }], error: null })
      if (table === 'live_classes') return query({ data: [{ id: 'session-1', course_id: '00000000-0000-4000-8000-000000000a01' }], error: null })
      if (table === 'class_timetable_slots') return query({ data: [{ id: 'slot-1', course_id: '00000000-0000-4000-8000-000000000a01', weekday: 1 }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/00000000-0000-4000-8000-0000000000c1/schedule')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { subjects: [{ id: '00000000-0000-4000-8000-000000000a01' }] } })
    expect(mocks.from).toHaveBeenCalledWith('tutor_course_assignments')
  })

  it('does not query sessions when a requested subject is outside the class', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'class-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [{ id: '00000000-0000-4000-8000-000000000a01', name: 'Physics', programme_id: 'class-1' }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/00000000-0000-4000-8000-0000000000c1/schedule?course_id=00000000-0000-4000-8000-000000000a02')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'SUBJECT_NOT_FOUND' })
    expect(mocks.from).not.toHaveBeenCalledWith('live_classes')
    expect(mocks.from).not.toHaveBeenCalledWith('class_timetable_slots')
  })

  it('returns an empty schedule for an existing class with no subjects', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: '00000000-0000-4000-8000-0000000000c1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [], error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await classesRouter.request('/00000000-0000-4000-8000-0000000000c1/schedule')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { subjects: [], sessions: [], recurring_slots: [] } })
  })

  it('rejects malformed schedule filters before any query', async () => {
    for (const qs of ['course_id=nope', 'from=yesterday', 'from=2026-02-01&to=2026-01-01', 'limit=0', 'limit=99999']) {
      const response = await classesRouter.request(`/00000000-0000-4000-8000-0000000000c1/schedule?${qs}`)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('never returns database error text from a schedule or timetable failure', async () => {
    mocks.from.mockImplementation(() => query({ data: null, error: { message: 'relation secret_table exploded' } }))
    const schedule = await classesRouter.request('/00000000-0000-4000-8000-0000000000c1/schedule')
    expect(schedule.status).toBe(500)
    expect(JSON.stringify(await schedule.json())).not.toContain('secret_table')
    const timetable = await classesRouter.request('/timetable')
    expect(timetable.status).toBe(500)
    expect(JSON.stringify(await timetable.json())).not.toContain('secret_table')
  })

  it('rejects malformed timetable filters', async () => {
    const response = await classesRouter.request('/timetable?tutor_id=not-a-uuid')
    expect(response.status).toBe(400)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { classesRouter } from './classes'

function query(result: any) {
  const value: any = {
    select: () => value, eq: () => value, in: () => value, is: () => value,
    gte: () => value, lte: () => value, order: () => value,
    maybeSingle: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('class-first API aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('serves the cross-class recurring timetable without invoking a legacy programme route', async () => {
    mocks.from.mockReturnValue(query({ data: [{ id: 'slot-1', weekday: 1, course_id: 'physics' }], error: null }))

    const response = await classesRouter.request('/timetable')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: 'slot-1', weekday: 1, course_id: 'physics' }] })
    expect(mocks.from).toHaveBeenCalledWith('class_timetable_slots')
    expect(mocks.from).not.toHaveBeenCalledWith('programmes')
  })

  it('does not expose centre-wide timetable to a tutor', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }

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
      if (table === 'courses') return query({ data: [{ id: 'physics', name: 'Physics', programme_id: 'class-1' }], error: null })
      if (table === 'live_classes') return query({ data: [{ id: 'session-1', course_id: 'physics' }], error: null })
      if (table === 'class_timetable_slots') return query({ data: [{ id: 'slot-1', course_id: 'physics', weekday: 1 }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/class-1/schedule?course_id=physics')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        subjects: [{ id: 'physics', name: 'Physics', programme_id: 'class-1' }],
        sessions: [{ id: 'session-1', course_id: 'physics' }],
        recurring_slots: [{ id: 'slot-1', course_id: 'physics', weekday: 1 }],
      },
    })
  })

  it('limits a tutor schedule read to subjects assigned to that tutor', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'class-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [
        { id: 'physics', name: 'Physics', programme_id: 'class-1' },
        { id: 'chemistry', name: 'Chemistry', programme_id: 'class-1' },
      ], error: null })
      if (table === 'tutor_course_assignments') return query({ data: [{ course_id: 'physics' }], error: null })
      if (table === 'live_classes') return query({ data: [{ id: 'session-1', course_id: 'physics' }], error: null })
      if (table === 'class_timetable_slots') return query({ data: [{ id: 'slot-1', course_id: 'physics', weekday: 1 }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/class-1/schedule')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { subjects: [{ id: 'physics' }] } })
    expect(mocks.from).toHaveBeenCalledWith('tutor_course_assignments')
  })

  it('does not query sessions when a requested subject is outside the class', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return query({ data: { id: 'class-1' }, error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [{ id: 'physics', name: 'Physics', programme_id: 'class-1' }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await classesRouter.request('/class-1/schedule?course_id=chemistry')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'SUBJECT_NOT_FOUND' })
    expect(mocks.from).not.toHaveBeenCalledWith('live_classes')
    expect(mocks.from).not.toHaveBeenCalledWith('class_timetable_slots')
  })
})

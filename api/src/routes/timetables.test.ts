import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  insertedSlot: null as any,
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { timetablesRouter } from './timetables'

function builder(result: any, onInsert?: (value: any) => void) {
  const value: any = {
    select: () => value,
    insert: (inserted: any) => { onInsert?.(inserted); return value },
    delete: () => value,
    eq: () => value,
    order: () => value,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (settled: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('timetable API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedSlot = null
  })

  it('creates a draft scoped to exactly one programme', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'programmes') return builder({ data: { id: 'programme-1' }, error: null })
      if (table === 'class_timetables') return builder({ data: { id: 'timetable-1', status: 'draft' }, error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await timetablesRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ programme_id: 'programme-1', timezone: 'Africa/Lagos' }),
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ data: { id: 'timetable-1', status: 'draft' } })
  })

  it('adds an assigned class as this-week-only without changing assignments', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'class_timetables') return builder({ data: { id: 'timetable-1', status: 'draft', programme_id: 'programme-1', standalone_course_id: null }, error: null })
      if (table === 'courses') return builder({ data: { id: 'course-1', programme_id: 'programme-1' }, error: null })
      if (table === 'tutor_course_assignments') return builder({ data: { id: 'assignment-1' }, error: null })
      if (table === 'class_timetable_slots') return builder({ data: { id: 'slot-1' }, error: null }, inserted => { mocks.insertedSlot = inserted })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await timetablesRouter.request('/timetable-1/slots', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ course_id: 'course-1', tutor_id: 'tutor-1', weekday: 4, start_time: '17:30', recurrence: 'this_week', week_start: '2026-09-07' }),
    })
    expect(response.status).toBe(201)
    expect(mocks.insertedSlot).toMatchObject({
      timetable_id: 'timetable-1', course_id: 'course-1', tutor_id: 'tutor-1',
      starts_on: '2026-09-07', ends_on: '2026-09-13', duration_minutes: 60,
    })
  })

  it('publishes through the transactional materialization function', async () => {
    mocks.rpc.mockResolvedValue({ data: 12, error: null })
    const response = await timetablesRouter.request('/timetable-1/publish', { method: 'POST' })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('publish_class_timetable', {
      p_timetable_id: 'timetable-1', p_school_id: 'school-1', p_published_by: 'admin-1',
    })
    expect(await response.json()).toMatchObject({ message: 'Timetable published', generated_classes: 12 })
  })

  it('opens draft changes without withdrawing the published timetable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const response = await timetablesRouter.request('/timetable-1/edit', { method: 'POST' })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('unpublish_class_timetable', {
      p_timetable_id: 'timetable-1', p_school_id: 'school-1', p_actor_id: 'admin-1',
    })
    expect(await response.json()).toEqual({ message: 'Draft changes opened; students still see the published timetable' })
  })
})

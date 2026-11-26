import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'account-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../middleware/account-projection', () => ({
  accountUserProjection: async (_c: any, next: () => Promise<void>) => next(),
}))

import { attendanceRouter } from './attendance'

const PROGRAMME = '00000000-0000-4000-8000-0000000000a1'
const SUB = '00000000-0000-4000-8000-0000000000b1'

type Call = { table: string; filters: any[] }

function install(tables: Record<string, { data?: any; error?: any }>) {
  const calls: Call[] = []
  mocks.from.mockImplementation((table: string) => {
    const call: Call = { table, filters: [] }
    calls.push(call)
    const builder: any = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === 'then') {
          const result = tables[table] || { data: [] }
          return (resolve: any, reject: any) => Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject)
        }
        return (...args: any[]) => { call.filters.push([prop, ...args]); return builder }
      },
    })
    return builder
  })
  return calls
}

describe('attendance reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'account-1', role: 'admin' }
  })

  it('rejects malformed and inverted filters before any query', async () => {
    for (const qs of [
      'page=0', 'limit=1000', 'page=abc', 'class_id=nope', 'programme_id=1',
      'start_date=yesterday', 'start_date=2026-02-01&end_date=2026-01-01',
    ]) {
      for (const path of ['/metrics', '/records']) {
        const response = await attendanceRouter.request(`${path}?${qs}`)
        expect(response.status, `${path}?${qs}`).toBe(400)
        expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
      }
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('accepts the date shapes the dashboard sends', async () => {
    install({ live_classes: { data: [] } })
    const response = await attendanceRouter.request('/records?start_date=2026-01-01&end_date=2026-01-31T23:59:59.999&page=2')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], meta: { total: 0, page: 2, limit: 20 } })
  })

  it('fails instead of reporting zero metrics when enrolments cannot be read', async () => {
    install({
      live_classes: { data: [{ id: 'lc1', course_id: 'c1', scheduled_at: '2026-01-01T09:00:00Z' }] },
      courses: { data: [{ id: 'c1', sub_programme_id: null, programme_id: PROGRAMME }] },
      enrolments: { error: { message: 'relation secret_table missing' } },
    })
    const response = await attendanceRouter.request('/metrics')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: 'Attendance data is temporarily unavailable', code: 'ATTENDANCE_UNAVAILABLE' })
  })

  it('fails instead of reporting absences when attendance records cannot be read', async () => {
    install({
      live_classes: { data: [{ id: 'lc1', course_id: 'c1', scheduled_at: '2026-01-01T09:00:00Z' }] },
      courses: { data: [{ id: 'c1', sub_programme_id: null, programme_id: PROGRAMME }] },
      enrolments: { data: [{ student_id: 'u1', programme_id: PROGRAMME }] },
      attendance_records: { error: { message: 'timeout' } },
    })
    const response = await attendanceRouter.request('/records')
    expect(response.status).toBe(500)
  })

  it('counts Programme-level enrolments on Subjects nested under a Sub-programme', async () => {
    const calls = install({
      live_classes: { data: [{ id: 'lc1', course_id: 'c1', scheduled_at: '2026-01-01T09:00:00Z', title: 'T' }] },
      courses: { data: [{ id: 'c1', sub_programme_id: SUB, programme_id: null }] },
      sub_programmes: { data: [{ id: SUB, programme_id: PROGRAMME }] },
      enrolments: { data: [{ student_id: 'u1', course_id: null, sub_programme_id: null, programme_id: PROGRAMME, user_profiles: { first_name: 'Ada', last_name: 'L' } }] },
      attendance_records: { data: [] },
    })
    const response = await attendanceRouter.request('/records')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ student_id: 'u1', status: 'Absent' })
    const enrolmentCall = calls.find((call) => call.table === 'enrolments')!
    expect(JSON.stringify(enrolmentCall.filters)).toContain(`programme_id.in.(${PROGRAMME})`)
  })

  it('resolves a Programme filter through its Sub-programmes', async () => {
    const calls = install({
      sub_programmes: { data: [{ id: SUB }] },
      courses: { data: [] },
      live_classes: { data: [] },
    })
    const response = await attendanceRouter.request(`/metrics?programme_id=${PROGRAMME}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { total_sessions: 0 } })
    const courseCall = calls.find((call) => call.table === 'courses')!
    expect(JSON.stringify(courseCall.filters)).toContain(`sub_programme_id.in.(${SUB})`)
  })
})

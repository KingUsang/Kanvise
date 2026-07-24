import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
}))

import { dashboardRouter } from './dashboard'

function query(result: any) {
  const value: any = {
    select: () => value,
    eq: () => value,
    in: () => value,
    is: () => value,
    order: () => value,
    limit: () => value,
    then: (resolve: (result: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('student progress route security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
  })

  it('rejects non-students before querying progress data', async () => {
    mocks.user.role = 'tutor'
    const response = await dashboardRouter.request('/student/progress')
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects non-students from the student dashboard before querying activity', async () => {
    mocks.user.role = 'admin'
    const response = await dashboardRouter.request('/student')
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an empty recorded-data summary when the student has no enrolled courses', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'enrolments') return query({ data: [], error: null })
      if (table === 'courses' || table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'mock_marketplace_entitlements') return query({ data: [], error: null })
      throw new Error(`Progress must not query ${table} without an entitled course`)
    })

    const response = await dashboardRouter.request('/student/progress')
    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.data.courses).toEqual([])
    expect(body.data.overall.attendance_percentage).toBeNull()
    expect(mocks.from).toHaveBeenCalledTimes(4)
  })

  it('includes marketplace results for a centreless student without querying centre data', async () => {
    mocks.user = { id: 'student-1', school_id: null, role: 'student' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'mock_marketplace_entitlements') return query({ data: [{ listing: { source_mock_id: 'market-mock-1', title: 'JAMB practice' } }], error: null })
      if (table === 'mock_attempts') return query({ data: [{ id: 'attempt-1', mock_exam_id: 'market-mock-1', status: 'submitted', submitted_at: '2026-07-24', total_score: 16, total_marks: 20 }], error: null })
      throw new Error(`Centre table ${table} must not be queried for a marketplace-only student`)
    })
    const response = await dashboardRouter.request('/student/progress')
    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.data.overall.mock_average_percentage).toBe(80)
    expect(body.data.recent_mock_results[0].title).toBe('JAMB practice')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'admin-1', school_id: 'legacy-school', role: 'admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  ACCOUNT_CONTEXT_HEADER: 'X-Kanvise-Account-Id',
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
    c.set('account', mocks.account)
    await next()
  },
}))

import { resolveStudentCourses } from '../lib/student-course-access'
import { dashboardRouter } from './dashboard'

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

const courses = [
  { id: 'direct', name: 'Direct course', programme_id: null, sub_programme_id: null },
  { id: 'programme-child', name: 'Programme course', programme_id: 'programme-1', sub_programme_id: null },
  { id: 'sub-child', name: 'Sub-programme course', programme_id: null, sub_programme_id: 'sub-1' },
  { id: 'programme-sub-child', name: 'Programme sub-course', programme_id: null, sub_programme_id: 'sub-under-programme-1' },
  { id: 'other', name: 'Other course', programme_id: 'programme-2', sub_programme_id: null },
]

describe('resolveStudentCourses', () => {
  it('combines direct, programme, and sub-programme access without leaking other courses', () => {
    const result = resolveStudentCourses([
      { programme_id: null, sub_programme_id: null, course_id: 'direct' },
      { programme_id: 'programme-1', sub_programme_id: null, course_id: null },
      { programme_id: null, sub_programme_id: 'sub-1', course_id: null },
    ], courses, [{ id: 'sub-under-programme-1', programme_id: 'programme-1' }])

    expect(result.map((course) => course.id)).toEqual(['direct', 'programme-child', 'sub-child', 'programme-sub-child'])
  })

  it('returns no courses when the student has no enrolments', () => {
    expect(resolveStudentCourses([], courses)).toEqual([])
  })
})

describe('dashboard account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'legacy-school', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
  })

  it('requires a selected active account for account-backed capabilities', async () => {
    mocks.account = null

    const response = await dashboardRouter.request('/capabilities')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('projects the selected account instead of trusting profile school_id', async () => {
    const assignmentQuery = query({ data: null, error: null })
    const schoolQuery = query({ data: { account_type: 'centre' }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tutor_course_assignments') return assignmentQuery
      if (table === 'schools') return schoolQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await dashboardRouter.request('/capabilities')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { is_admin: true, is_tutor: false } })
    expect(schoolQuery.eq).toHaveBeenCalledWith('id', 'account-1')
    expect(schoolQuery.eq).not.toHaveBeenCalledWith('id', 'legacy-school')
  })
})

describe('dashboard /stats data_status', () => {
  function chain(result: any) {
    const b: any = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === 'then') return (resolve: (v: any) => void) => Promise.resolve(result).then(resolve)
        if (prop === 'maybeSingle' || prop === 'single') return async () => result
        return () => b
      },
    })
    return b
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'admin' }
  })

  it('reports failed sources instead of presenting zeros as real data', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'schools') return chain({ data: { account_type: 'centre' }, error: null, count: 0 })
      if (table === 'payments') return chain({ data: null, error: { code: 'XX000' }, count: null })
      return chain({ data: [], error: null, count: 0 })
    })
    const response = await dashboardRouter.request('/stats')
    const body = await response.json() as any
    expect(response.status).toBe(200)
    expect(body.data.data_status).toEqual({ partial: true, failed_sources: ['mtd_revenue', 'successful_payments'] })
  })

  it('reports a complete response when every source succeeds', async () => {
    mocks.from.mockImplementation((table: string) => chain(
      table === 'schools' ? { data: { account_type: 'centre' }, error: null, count: 0 } : { data: [], error: null, count: 0 }))
    const response = await dashboardRouter.request('/stats')
    const body = await response.json() as any
    expect(response.status).toBe(200)
    expect(body.data.data_status).toEqual({ partial: false, failed_sources: [] })
  })

  it('marks the grading source failed when the aggregate errors (DEV-DSH-002)', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } })
    mocks.from.mockImplementation((table: string) => chain(
      table === 'schools' ? { data: { account_type: 'centre' }, error: null, count: 0 } : { data: [], error: null, count: 0 }))
    const body = await (await dashboardRouter.request('/stats')).json() as any
    expect(body.data.data_status).toEqual({ partial: true, failed_sources: ['needs_grading'] })
  })

  it('marks the teaching capability check failed instead of silently dropping it (DEV-DSH-002)', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'schools') return chain({ data: { account_type: 'centre' }, error: null, count: 0 })
      if (table === 'tutor_course_assignments') return chain({ data: [], error: { code: 'XX000' }, count: null })
      return chain({ data: [], error: null, count: 0 })
    })
    const body = await (await dashboardRouter.request('/stats')).json() as any
    expect(body.data.data_status.failed_sources).toContain('tutor_capability')
  })

  it('ranks grading work with one aggregate call and no per-assignment submission counts (DEV-DSH-003)', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'dashboard_needs_grading'
      ? { data: [{ out_assignment_id: 'a1', out_title: 'Essay', out_course_name: 'English', out_pending_count: 5, out_total_count: 10 }], error: null }
      : { data: [], error: null })
    const tables: string[] = []
    mocks.from.mockImplementation((table: string) => {
      tables.push(table)
      return chain(table === 'schools' ? { data: { account_type: 'centre' }, error: null, count: 0 } : { data: [], error: null, count: 0 })
    })
    const body = await (await dashboardRouter.request('/stats')).json() as any
    expect(body.data.admin_stats.needs_grading[0]).toMatchObject({ id: 'a1', pending_count: 5, progress: 50, context: 'English • 5 waiting' })
    expect(mocks.rpc).toHaveBeenCalledWith('dashboard_needs_grading', { p_school_id: 'school-1', p_tutor_id: null, p_limit: 3 })
    expect(tables).not.toContain('submissions')
    expect(tables).not.toContain('assignments')
  })

  it('counts headcounts from active account memberships, not profile hints (DEV-DSH-005)', async () => {
    const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = []
    mocks.from.mockImplementation((table: string) => {
      const entry = { table, filters: [] as Array<[string, unknown]> }
      reads.push(entry)
      const result = table === 'schools' ? { data: { account_type: 'centre' }, error: null, count: 0 }
        : table === 'account_memberships' ? { data: [{ person_id: 't1', role: 'tutor' }, { person_id: 'adm', role: 'admin' }], error: null, count: 7 }
        : table === 'tutor_course_assignments' ? { data: [{ tutor_id: 'adm' }, { tutor_id: 'revoked-tutor' }], error: null, count: 0 }
        : { data: [], error: null, count: 0 }
      const b: any = new Proxy({}, {
        get: (_t, prop) => {
          if (prop === 'then') return (resolve: (v: any) => void) => Promise.resolve(result).then(resolve)
          if (prop === 'maybeSingle' || prop === 'single') return async () => result
          return (...args: unknown[]) => { entry.filters.push([String(prop), args[0]]); return b }
        },
      })
      return b
    })
    const body = await (await dashboardRouter.request('/stats')).json() as any
    expect(reads.map((r) => r.table)).not.toContain('user_profiles')
    expect(body.data.admin_stats.total_students).toBe(7)
    // t1 (active tutor) and adm (active admin who teaches); the revoked tutor is excluded.
    expect(body.data.admin_stats.tutors_count).toBe(2)
    const membershipReads = reads.filter((r) => r.table === 'account_memberships')
    expect(membershipReads.every((r) => r.filters.some(([k]) => k === 'eq'))).toBe(true)
  })

  it('exposes the explicit reporting timezone and boundaries (DEV-DSH-004)', async () => {
    mocks.from.mockImplementation((table: string) => chain(
      table === 'schools' ? { data: { account_type: 'centre' }, error: null, count: 0 } : { data: [], error: null, count: 0 }))
    const body = await (await dashboardRouter.request('/stats?tz=Asia/Tokyo')).json() as any
    expect(body.data.reporting.timezone).toBe('Asia/Tokyo')
    expect(new Date(body.data.reporting.today_end).getTime() - new Date(body.data.reporting.today_start).getTime()).toBe(24 * 3600_000 - 1)
    const fallback = await (await dashboardRouter.request('/stats?tz=nope')).json() as any
    expect(fallback.data.reporting.timezone).toBe('Africa/Lagos')
  })
})

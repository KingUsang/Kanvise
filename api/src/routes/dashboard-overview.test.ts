import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, any>,
  filters: [] as Array<{ table: string; op: string; args: any[] }>,
  user: { id: 'tutor-1', school_id: 'legacy', role: 'tutor' } as any,
  account: { id: 'account-1', membershipId: 'm-1', role: 'tutor' } as any,
  learners: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builder: any = {}
      for (const op of ['select', 'eq', 'gte', 'lte', 'gt', 'in', 'order', 'limit']) {
        builder[op] = vi.fn((...args: any[]) => {
          mocks.filters.push({ table, op, args })
          return builder
        })
      }
      builder.maybeSingle = async () => mocks.tables[table]
      builder.then = (resolve: (value: any) => void) => Promise.resolve(mocks.tables[table]).then(resolve)
      return builder
    },
    rpc: vi.fn(),
  },
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', mocks.account)
    await next()
  },
}))
vi.mock('../lib/student-course-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/student-course-access')>()),
  listCourseLearnerIds: mocks.learners,
}))

import { dashboardRouter } from './dashboard'

const soon = new Date(Date.now() + 10 * 60_000).toISOString()
const lesson = (overrides: Record<string, unknown> = {}) => ({
  id: 'l-1',
  title: 'Quadratics',
  scheduled_at: soon,
  duration_minutes: 60,
  status: 'scheduled',
  course_id: 'c-1',
  tutor_id: 'tutor-1',
  courses: { name: 'Algebra 1 Small Group' },
  ...overrides,
})

function setup(opts: {
  role?: 'admin' | 'tutor'
  accountType?: 'independent' | 'centre'
  teaches?: boolean
  lessons?: any[]
} = {}) {
  mocks.user = { id: 'tutor-1', school_id: 'legacy', role: opts.role ?? 'tutor' }
  mocks.account = { id: 'account-1', membershipId: 'm-1', role: opts.role ?? 'tutor' }
  mocks.tables = {
    schools: { data: { account_type: opts.accountType ?? 'centre' }, error: null },
    tutor_course_assignments: { data: opts.teaches ? { id: 'a-1' } : null, error: null },
    live_classes: { data: opts.lessons ?? [], error: null },
    user_profiles: { data: [{ id: 'tutor-1', first_name: 'Michael', last_name: 'Chen' }], error: null },
  }
}

const get = (query = '') => dashboardRouter.request(`/overview${query}`)

describe('GET /dashboard/overview', () => {
  beforeEach(() => {
    mocks.filters.length = 0
    mocks.learners.mockReset().mockResolvedValue(['s-1'])
  })

  it('returns an agency tutor only their own lessons, without tutor names', async () => {
    setup({ role: 'tutor', lessons: [lesson()] })
    const body = (await (await get()).json()).data
    expect(body.view).toBe('agency_tutor')
    expect(body.scope).toBe('own')
    expect(body.today[0]).toMatchObject({
      title: 'Quadratics',
      course_name: 'Algebra 1 Small Group',
      student_count: 1,
      tutor_name: null,
      status: 'starting-soon',
    })
    expect(mocks.filters.some((f) => f.table === 'live_classes' && f.op === 'eq' && f.args[0] === 'tutor_id' && f.args[1] === 'tutor-1')).toBe(true)
    expect(mocks.filters.some((f) => f.table === 'user_profiles')).toBe(false)
  })

  it('shows an agency admin every tutor with names, and narrows with mine=1', async () => {
    setup({ role: 'admin', lessons: [lesson({ tutor_id: 'tutor-2' })] })
    mocks.tables.user_profiles = { data: [{ id: 'tutor-2', first_name: 'Priya', last_name: 'Shah' }], error: null }
    const body = (await (await get()).json()).data
    expect(body.view).toBe('agency_admin')
    expect(body.scope).toBe('all')
    expect(body.today[0].tutor_name).toBe('Priya Shah')
    expect(mocks.filters.some((f) => f.table === 'live_classes' && f.args[0] === 'tutor_id' && f.op === 'eq')).toBe(false)

    mocks.filters.length = 0
    const mine = (await (await get('?mine=1')).json()).data
    expect(mine.scope).toBe('own')
    expect(mocks.filters.some((f) => f.table === 'live_classes' && f.op === 'eq' && f.args[0] === 'tutor_id')).toBe(true)
  })

  it('treats an independent account as its own tutor view', async () => {
    setup({ role: 'admin', accountType: 'independent', teaches: true, lessons: [lesson()] })
    const body = (await (await get('?mine=1')).json()).data
    expect(body.view).toBe('independent')
    expect(body.scope).toBe('own')
    expect(body.teaches).toBe(true)
  })

  it('groups the week by day and reports the empty states', async () => {
    setup({ role: 'tutor', lessons: [] })
    const body = (await (await get('?tz=Africa/Lagos')).json()).data
    expect(body.today).toEqual([])
    expect(body.next_lesson).toBeNull()
    expect(body.has_any_lesson).toBe(false)
    expect(body.week.days).toHaveLength(7)
    expect(body.week.days.every((day: any) => day.lesson_count === 0)).toBe(true)
    expect(body.classroom_opens_minutes).toBe(15)
  })

  it('counts lessons per day and keeps a null student count when the lookup fails', async () => {
    setup({ role: 'tutor', lessons: [lesson()] })
    mocks.learners.mockRejectedValue(new Error('boom'))
    const body = (await (await get('?tz=UTC')).json()).data
    expect(body.today[0].student_count).toBeNull()
    expect(body.week.lessons[0].day_index).toBeGreaterThanOrEqual(0)
    expect(body.week.days.reduce((sum: number, day: any) => sum + day.lesson_count, 0)).toBe(body.week.lessons.length)
  })

  it('clamps the week offset and rejects non-staff roles', async () => {
    setup({ role: 'tutor' })
    expect((await (await get('?week=999')).json()).data.week.offset).toBe(52)
    expect((await (await get('?week=abc')).json()).data.week.offset).toBe(0)
    mocks.user = { id: 's-1', school_id: 'legacy', role: 'student' }
    mocks.account = { id: 'account-1', membershipId: 'm-2', role: 'learner' }
    expect((await get()).status).toBe(403)
  })

  it('returns a generic error when a source fails', async () => {
    setup({ role: 'tutor' })
    mocks.tables.live_classes = { data: null, error: { code: 'XX', message: 'secret detail' } }
    const response = await get()
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('secret detail')
  })
})

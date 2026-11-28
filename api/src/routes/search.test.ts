import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { method: string; args: unknown[] }
type Recorded = { table: string; calls: Call[] }

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  authenticated: true,
  user: { id: 'person-1', school_id: 'legacy-account', role: 'admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
  recorded: [] as Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }>,
  rows: {} as Record<string, (calls: Array<{ method: string; args: unknown[] }>) => unknown>,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.authenticated) return c.json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401)
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
    c.set('account', mocks.account)
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Insufficient role', code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { searchRouter } from './search'
import { containsPattern, lessonChipStatus, normaliseSearchTerm } from '../lib/global-search'

/** A chainable supabase-js stand-in that records every filter call. */
function builder(table: string) {
  const record: Recorded = { table, calls: [] }
  mocks.recorded.push(record)
  const result = () => ({ data: mocks.rows[table]?.(record.calls) ?? [], error: null })
  const value: any = {
    then: (resolve: (v: any) => void, reject: (e: unknown) => void) => Promise.resolve(result()).then(resolve, reject),
    maybeSingle: async () => {
      const data = result().data
      return { data: Array.isArray(data) ? data[0] ?? null : data, error: null }
    },
  }
  for (const method of ['select', 'eq', 'neq', 'in', 'ilike', 'gte', 'lt', 'order', 'limit', 'or']) {
    value[method] = (...args: unknown[]) => { record.calls.push({ method, args }); return value }
  }
  return value
}

const calls = (table: string) => mocks.recorded.filter((entry) => entry.table === table)
const has = (entry: Recorded, method: string, ...args: unknown[]) =>
  entry.calls.some((call) => call.method === method && args.every((arg, index) => call.args[index] === arg))

async function search(q: string) {
  const response = await searchRouter.request(`/?q=${encodeURIComponent(q)}&tz=Africa/Lagos`)
  return { status: response.status, body: await response.json() as any }
}

const NOW_PLUS_DAY = new Date(Date.now() + 86_400_000).toISOString()

describe('GET /search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticated = true
    mocks.user = { id: 'person-1', school_id: 'legacy-account', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
    mocks.recorded = []
    mocks.rows = {
      schools: () => [{ account_type: 'centre' }],
      account_memberships: (filters) => {
        const role = filters.find((call) => call.method === 'eq' && call.args[0] === 'role')?.args[1]
        return role === 'learner'
          ? [{ person: { id: 'student-1', first_name: 'Ada', last_name: 'Lovelace', email: null } }]
          : [{ person: { id: 'tutor-1', first_name: 'Adam', last_name: 'Smith', email: 'adam@example.com' } }]
      },
      programmes: () => [{ id: 'course-1', name: 'Adaptive Maths' }],
      live_classes: (filters) => filters.some((call) => call.method === 'gte')
        ? [{ id: 'lesson-1', title: 'Ada revision', scheduled_at: NOW_PLUS_DAY, status: 'scheduled', course: { name: 'Adaptive Maths' } }]
        : [],
      tutor_course_assignments: () => [{ course_id: 'subject-1' }],
      courses: () => [{ id: 'subject-1', programme_id: 'course-1', sub_programme_id: null }],
    }
    mocks.from.mockImplementation((table: string) => builder(table))
  })

  it('rejects an unauthenticated request before touching the database', async () => {
    mocks.authenticated = false
    const { status } = await search('Ada')
    expect(status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('needs a selected account and a staff role', async () => {
    mocks.account = null
    expect((await search('Ada')).status).toBe(400)
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'learner' }
    expect((await search('Ada')).status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns empty groups for fewer than two characters or more than 100', async () => {
    for (const q of ['', ' a ', 'x'.repeat(101)]) {
      const { status, body } = await search(q)
      expect(status).toBe(200)
      expect(body.data.groups).toEqual([])
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('gives an agency admin every group, each opening a page on this branch', async () => {
    const { status, body } = await search('Ada')
    expect(status).toBe(200)
    expect(body.data.groups.map((group: any) => group.label)).toEqual(['Students', 'Tutors', 'Courses', 'Lessons'])
    const results = body.data.groups.flatMap((group: any) => group.results)
    expect(results.map((result: any) => result.href)).toEqual([
      '/dashboard/students', '/dashboard/tutors', '/dashboard/classes/course-1', '/dashboard/schedule/lesson-1',
    ])
    expect(results[0]).toMatchObject({ name: 'Ada Lovelace', detail: 'No email' })
    expect(results[3]).toMatchObject({ status: 'planned' })
    expect(results[3].detail).toMatch(/^Adaptive Maths · \d{1,2} [A-Z][a-z]{2} \d{4}$/)
  })

  it('filters every query by the active account, never the profile account', async () => {
    await search('Ada')
    expect(mocks.recorded.length).toBeGreaterThan(0)
    for (const entry of mocks.recorded) {
      const scoped = entry.table === 'schools' ? has(entry, 'eq', 'id', 'account-1') : has(entry, 'eq', 'school_id', 'account-1')
      expect(scoped, `${entry.table} is scoped to the active account`).toBe(true)
      expect(entry.calls.some((call) => call.args.includes('legacy-account'))).toBe(false)
    }
  })

  it('finds people through active memberships, not the profile account', async () => {
    await search('Ada')
    const people = calls('account_memberships')
    expect(people.length).toBeGreaterThan(0)
    expect(calls('user_profiles')).toHaveLength(0)
    for (const entry of people) {
      expect(has(entry, 'eq', 'status', 'active')).toBe(true)
      expect(has(entry, 'eq', 'person.is_active', true)).toBe(true)
    }
    const roles = people.map((entry) => entry.calls.find((call) => call.method === 'eq' && call.args[0] === 'role')?.args[1])
    expect(new Set(roles)).toEqual(new Set(['learner', 'tutor']))
  })

  it('does not give a tutor the Students or Tutors groups', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'tutor' }
    const { body } = await search('Ada')
    expect(body.data.groups.map((group: any) => group.type)).toEqual(['course', 'lesson'])
    expect(calls('account_memberships')).toHaveLength(0)
  })

  it('gives a tutor only the courses they teach and their own lessons', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'tutor' }
    await search('Ada')
    const [assignments] = calls('tutor_course_assignments')
    expect(has(assignments, 'eq', 'tutor_id', 'person-1')).toBe(true)
    const [programmes] = calls('programmes')
    expect(programmes.calls).toContainEqual({ method: 'in', args: ['id', ['course-1']] })
    for (const lessons of calls('live_classes')) expect(has(lessons, 'eq', 'tutor_id', 'person-1')).toBe(true)
  })

  it('finds no courses for a tutor with no assignments', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'tutor' }
    mocks.rows.tutor_course_assignments = () => []
    const { body } = await search('Ada')
    expect(calls('programmes')).toHaveLength(0)
    expect(body.data.groups.map((group: any) => group.type)).toEqual(['lesson'])
  })

  it('hides the Tutors group from an independent tutor', async () => {
    mocks.rows.schools = () => [{ account_type: 'independent' }]
    const { body } = await search('Ada')
    expect(body.data.groups.map((group: any) => group.type)).toEqual(['student', 'course', 'lesson'])
  })

  it('escapes LIKE wildcards in what was typed', async () => {
    await search('50%_off\\')
    const [programmes] = calls('programmes')
    expect(programmes.calls).toContainEqual({ method: 'ilike', args: ['name', '%50\\%\\_off\\\\%'] })
  })

  it('searches first and last name together when the text has a space', async () => {
    await search('Ada Love')
    const fullName = calls('account_memberships').find((entry) => entry.calls.filter((call) => call.method === 'ilike').length === 2)
    expect(fullName?.calls).toContainEqual({ method: 'ilike', args: ['person.first_name', '%Ada%'] })
    expect(fullName?.calls).toContainEqual({ method: 'ilike', args: ['person.last_name', '%Love%'] })
  })
})

describe('search helpers', () => {
  it('normalises the search text', () => {
    expect(normaliseSearchTerm('  Ada   Love ')).toBe('Ada Love')
    expect(normaliseSearchTerm('a')).toBeNull()
    expect(normaliseSearchTerm(undefined)).toBeNull()
  })

  it('turns PostgREST * into a single-character wildcard', () => {
    expect(containsPattern('a*b')).toBe('%a_b%')
  })

  it('maps lesson rows to the status chip', () => {
    const now = new Date('2026-11-28T10:00:00Z')
    expect(lessonChipStatus({ status: 'scheduled', scheduled_at: '2026-11-28T12:00:00Z' }, now)).toBe('planned')
    expect(lessonChipStatus({ status: 'scheduled', scheduled_at: '2026-11-28T10:10:00Z' }, now)).toBe('starting-soon')
    expect(lessonChipStatus({ status: 'live', scheduled_at: '2026-11-28T09:50:00Z', classroom_provider: 'plugnmeet', provider_room_status: 'active' }, now)).toBe('live')
    expect(lessonChipStatus({ status: 'live', scheduled_at: '2026-11-28T09:50:00Z', classroom_provider: 'plugnmeet', provider_room_status: 'pending' }, now)).toBe('starting-soon')
    expect(lessonChipStatus({ status: 'completed', scheduled_at: '2026-11-27T10:00:00Z' }, now)).toBe('complete')
  })
})

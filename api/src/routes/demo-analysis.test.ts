import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'tutor-1', school_id: 'legacy-account', role: 'tutor' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'tutor' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
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

import { demoAnalysisRouter } from './demo-analysis'

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

function request() {
  return demoAnalysisRouter.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ studentId: 'student-1', classId: 'class-1' }),
  })
}

describe('demo analysis account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'legacy-account', role: 'tutor' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'tutor' }
  })

  it('requires a selected active account before analysis', async () => {
    mocks.account = null

    const response = await request()

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('limits Tutor analysis to an owned Class in the selected account', async () => {
    const classQuery = query({ data: { id: 'class-1', tutor_id: 'tutor-1', course_id: 'course-1' }, error: null })
    const studentQuery = query({ data: { first_name: 'Emeka', last_name: 'Learner' }, error: null })
    const attemptsQuery = query({ data: [], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'live_classes') return classQuery
      if (table === 'user_profiles') return studentQuery
      if (table === 'mock_attempts') return attemptsQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await request()

    expect(response.status).toBe(200)
    expect(classQuery.eq).toHaveBeenCalledWith('school_id', 'account-1')
    expect(classQuery.eq).toHaveBeenCalledWith('tutor_id', 'tutor-1')
    expect(studentQuery.eq).toHaveBeenCalledWith('school_id', 'account-1')
    expect(studentQuery.eq).not.toHaveBeenCalledWith('school_id', 'legacy-account')
  })

  it('does not disclose a Class from another account', async () => {
    const classQuery = query({ data: null, error: null })
    mocks.from.mockReturnValue(classQuery)

    const response = await request()

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'Class not found' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('maps Class lookup failure to a safe retryable response', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'secret database detail' } }))

    const response = await request()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Could not load the selected Class', code: 'DEMO_ANALYSIS_UNAVAILABLE' })
  })

  it('rejects Learner membership before analysis lookups', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'learner' }

    const response = await request()

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'INSUFFICIENT_ROLE' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

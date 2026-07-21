import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('user').role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { assignmentsRouter } from './assignments'

function query(result: any, calls: Array<[string, ...any[]]>) {
  const builder: any = {
    select: (...args: any[]) => { calls.push(['select', ...args]); return builder },
    eq: (...args: any[]) => { calls.push(['eq', ...args]); return builder },
    in: (...args: any[]) => { calls.push(['in', ...args]); return builder },
    order: (...args: any[]) => { calls.push(['order', ...args]); return builder },
    range: (...args: any[]) => { calls.push(['range', ...args]); return builder },
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('assignment ledger', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.role = 'tutor' })

  it('loads all tutor-course assignments with two fixed queries', async () => {
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockImplementation((table: string) => table === 'tutor_course_assignments'
      ? query({ data: [{ course_id: 'course-1' }, { course_id: 'course-2' }], error: null }, calls)
      : query({
          data: [{ id: 'assignment-1', title: 'Essay', submissions: [{ count: 4 }] }],
          error: null,
          count: 1,
        }, calls))

    const response = await assignmentsRouter.request('/?page=1&page_size=10')
    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledTimes(2)
    expect(calls).toContainEqual(['in', 'course_id', ['course-1', 'course-2']])
    expect(calls).toContainEqual(['range', 0, 9])
    const body = await response.json() as any
    expect(body.data[0].submission_count).toBe(4)
    expect(body.pagination).toEqual({ page: 1, page_size: 10, total: 1, has_more: false })
  })

  it('rejects an excessive page size before querying', async () => {
    const response = await assignmentsRouter.request('/?page_size=500')
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

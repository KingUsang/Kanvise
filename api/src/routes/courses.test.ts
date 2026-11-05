import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', school_id: 'school-1', role: 'admin' })
    await next()
  },
}))

import { coursesRouter } from './courses'

function query(result: any, calls: Array<[string, ...any[]]>) {
  const builder: any = {
    select: (...args: any[]) => { calls.push(['select', ...args]); return builder },
    eq: (...args: any[]) => { calls.push(['eq', ...args]); return builder },
    is: (...args: any[]) => { calls.push(['is', ...args]); return builder },
    order: (...args: any[]) => { calls.push(['order', ...args]); return builder },
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('course list filters', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects malformed boolean filters before querying', async () => {
    const response = await coursesRouter.request('/?standalone=yes')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('retains valid boolean filter behavior', async () => {
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockReturnValue(query({ data: [{ id: 'course-1' }], error: null }, calls))
    const response = await coursesRouter.request('/?standalone=true&is_published=false')
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['is', 'programme_id', null])
    expect(calls).toContainEqual(['is', 'sub_programme_id', null])
    expect(calls).toContainEqual(['eq', 'is_published', false])
  })
})

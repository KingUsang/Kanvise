import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn() }))
vi.mock('../domain/question-bank', () => ({
  BANK_VISIBILITIES: ['private', 'centre'],
  canEditQuestionBank: vi.fn(() => true),
  canReadQuestionBank: vi.fn(() => true),
  escapeLikePattern: (value: string) => value,
  validateQuestionInput: vi.fn(() => ({ errors: [] })),
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor' })
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { questionBanksRouter } from './question-banks'

function query(result: any, calls: Array<[string, ...any[]]>) {
  const builder: any = {
    select: (...args: any[]) => { calls.push(['select', ...args]); return builder },
    eq: (...args: any[]) => { calls.push(['eq', ...args]); return builder },
    is: (...args: any[]) => { calls.push(['is', ...args]); return builder },
    or: (...args: any[]) => { calls.push(['or', ...args]); return builder },
    order: (...args: any[]) => { calls.push(['order', ...args]); return builder },
    range: (...args: any[]) => { calls.push(['range', ...args]); return builder },
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('question bank pagination boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unsafe page offset before querying', async () => {
    const response = await questionBanksRouter.request('/?page=9007199254740991&page_size=2')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('retains the existing range for safe page inputs', async () => {
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockReturnValue(query({
      data: [{ id: 'bank-1', questions: [{ count: 2 }] }], error: null, count: 1,
    }, calls))

    const response = await questionBanksRouter.request('/?page=2&page_size=10')
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['range', 10, 19])
    expect((await response.json() as any).pagination).toEqual({ page: 2, page_size: 10, total: 1, has_more: false })
  })
})

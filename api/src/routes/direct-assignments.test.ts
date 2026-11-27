import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', { id: 'school-1', membershipId: 'm-1', role: 'tutor' }); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { directAssignmentsRouter, publicDirectAssignmentsRouter } from './direct-assignments'

function query(result: any, ranges: any[] = []) {
  const builder: any = {
    select: () => builder, eq: () => builder, order: () => builder, insert: () => builder,
    range: (...args: any[]) => { ranges.push(args); return builder },
    maybeSingle: async () => result, single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

const token = 'a'.repeat(43)
const post = (path: string, body: unknown) => publicDirectAssignmentsRouter.request(path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

describe('direct assignments', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('paginates the management list with metadata', async () => {
    const ranges: any[] = []
    mocks.from.mockReturnValue(query({ data: [{ id: 'd1', expires_at: '2099-01-01', direct_assignment_submissions: [{ count: 2 }] }], error: null, count: 5 }, ranges))
    const response = await directAssignmentsRouter.request('/?page=2&page_size=1')
    expect(response.status).toBe(200)
    expect(ranges).toEqual([[1, 1]])
    expect((await response.json() as any).pagination).toEqual({ page: 2, page_size: 1, total: 5, has_more: true })
  })

  it('rejects an oversized page size', async () => {
    const response = await directAssignmentsRouter.request('/?page_size=101')
    expect(response.status).toBe(400)
  })

  it('reports a lookup failure as a retryable 503, not a missing link', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { code: 'DB_DOWN', message: 'secret' } }))
    const response = await publicDirectAssignmentsRouter.request(`/${token}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'DIRECT_ASSIGNMENT_LOOKUP_FAILED' })
  })

  it('still returns 404 for an unknown or revoked link', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: null }))
    expect((await publicDirectAssignmentsRouter.request(`/${token}`)).status).toBe(404)
  })

  it('validates public submissions before inserting', async () => {
    mocks.from.mockReturnValue(query({ data: { id: 'd1', school_id: 'school-1', expires_at: '2099-01-01', revoked_at: null }, error: null }))
    const response = await post(`/${token}/submit`, { guest_name: 'A', response_text: 'x', guest_email: 'nope' })
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('VALIDATION_ERROR')
  })

  it('rejects an unvalidated create body', async () => {
    const response = await directAssignmentsRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'T', description: 'D', deadline_at: new Date(Date.now() + 7_200_000).toISOString(), expires_at: '2100-01-01' }),
    })
    expect(response.status).toBe(400)
  })
})

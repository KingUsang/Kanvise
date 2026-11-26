import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCHOOL = '11111111-1111-4111-8111-111111111111'
const P1 = '22222222-2222-4222-8222-222222222222'
const P2 = '33333333-3333-4333-8333-333333333333'
const TARGET = '44444444-4444-4444-8444-444444444444'

const mocks = vi.hoisted(() => ({ from: vi.fn(), verify: vi.fn(async () => undefined), del: vi.fn(async () => undefined) }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', () => ({
  deleteStoredObject: mocks.del,
  verifyPublicUpload: mocks.verify,
  StorageError: class StorageError extends Error { code = 'X'; status = 400 },
}))
vi.mock('../middleware/account-projection', () => ({ accountUserProjection: async (_c: any, next: () => Promise<void>) => next() }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', { id: 'u1', school_id: SCHOOL, role: 'admin' }); await next() },
  accountContextMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { promosRouter } from './promos'

function builder(result: any) {
  const b: any = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) b[m] = vi.fn(() => b)
  b.single = vi.fn(async () => result)
  b.maybeSingle = vi.fn(async () => result)
  b.then = (resolve: (v: any) => void) => Promise.resolve(result).then(resolve)
  return b
}
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const patch = (body: unknown) => ({ ...json(body), method: 'PATCH' })
const validCreate = { title: 'Promo', image_key: 'k', link_type: 'course', link_id: TARGET, content_type: 'image/png', file_size_bytes: 100 }

describe('promos routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects malformed create input before any database access', async () => {
    for (const bad of [{}, { ...validCreate, link_type: 'other' }, { ...validCreate, link_id: 'nope' }, { ...validCreate, title: '' }, { ...validCreate, extra: 1 }]) {
      const res = await promosRouter.request('/', json(bad))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a link target that is not in the account', async () => {
    mocks.from.mockReturnValue(builder({ data: null, error: null }))
    const res = await promosRouter.request('/', json(validCreate))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'INVALID_LINK_TARGET' })
  })

  it('creates a promo and hides database detail on failure', async () => {
    const lookup = builder({ data: { id: TARGET }, error: null })
    const insert = builder({ data: null, error: { message: 'secret detail' } })
    mocks.from.mockImplementation((t: string) => (t === 'courses' ? lookup : insert))
    const res = await promosRouter.request('/', json(validCreate))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Promo request could not be completed. Please try again.', code: 'PROMO_REQUEST_FAILED' })
  })

  it('requires the complete unique promo set for reorder', async () => {
    mocks.from.mockReturnValue(builder({ data: [{ id: P1 }, { id: P2 }], error: null }))
    expect((await promosRouter.request('/reorder', patch({ order: [P1, P1] }))).status).toBe(400)
    expect((await promosRouter.request('/reorder', patch({ order: ['bad'] }))).status).toBe(400)
    const partial = await promosRouter.request('/reorder', patch({ order: [P1] }))
    expect(partial.status).toBe(409)
    expect(await partial.json()).toMatchObject({ code: 'ORDER_MISMATCH' })
  })

  it('reports reorder database failures instead of success', async () => {
    const list = builder({ data: [{ id: P1 }, { id: P2 }], error: null })
    const update = builder({ error: { message: 'db' } })
    let calls = 0
    mocks.from.mockImplementation(() => (calls++ === 0 ? list : update))
    const res = await promosRouter.request('/reorder', patch({ order: [P2, P1] }))
    expect(res.status).toBe(500)
  })

  it('reorders when the set matches', async () => {
    const list = builder({ data: [{ id: P1 }, { id: P2 }], error: null })
    const update = builder({ error: null })
    let calls = 0
    mocks.from.mockImplementation(() => (calls++ === 0 ? list : update))
    const res = await promosRouter.request('/reorder', patch({ order: [P2, P1] }))
    expect(res.status).toBe(200)
    expect(update.update).toHaveBeenCalledWith({ order_index: 0 })
    expect(update.update).toHaveBeenCalledWith({ order_index: 1 })
  })

  it('returns 404 when deleting a missing promo and validates ids', async () => {
    mocks.from.mockReturnValue(builder({ data: null, error: null }))
    expect((await promosRouter.request(`/${P1}`, { method: 'DELETE' })).status).toBe(404)
    expect((await promosRouter.request('/not-a-uuid', { method: 'DELETE' })).status).toBe(400)
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('deletes the stored image after deleting an existing promo', async () => {
    mocks.from.mockReturnValue(builder({ data: { image_key: 'old' }, error: null }))
    expect((await promosRouter.request(`/${P1}`, { method: 'DELETE' })).status).toBe(200)
    expect(mocks.del).toHaveBeenCalledWith('old')
  })

  it('rejects unknown and empty update fields', async () => {
    expect((await promosRouter.request(`/${P1}`, patch({ school_id: SCHOOL }))).status).toBe(400)
    mocks.from.mockReturnValue(builder({ data: { id: P1, image_key: 'k', link_type: 'course', link_id: TARGET }, error: null }))
    expect((await promosRouter.request(`/${P1}`, patch({}))).status).toBe(400)
  })
})

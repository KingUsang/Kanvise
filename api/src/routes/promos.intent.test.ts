import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCHOOL = '11111111-1111-4111-8111-111111111111'
const TARGET = '44444444-4444-4444-8444-444444444444'
const PROMO = '22222222-2222-4222-8222-222222222222'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), verify: vi.fn(async () => undefined), del: vi.fn(async () => undefined),
  consume: vi.fn(async () => 'consumed'), release: vi.fn(async () => undefined),
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/upload-intents', () => ({ consumeUploadIntent: mocks.consume, releaseUploadIntent: mocks.release }))
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
const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const create = { title: 'Promo', image_key: 'k-new', link_type: 'course', link_id: TARGET, content_type: 'image/png', file_size_bytes: 100 }
const identity = { schoolId: SCHOOL, requesterId: 'u1', fileKey: 'k-new' }

describe('promo registration consumes the upload intent', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.consume.mockResolvedValue('consumed') })

  it('consumes on create and keeps it consumed on success', async () => {
    mocks.from.mockImplementation((t: string) => builder(t === 'courses' ? { data: { id: TARGET }, error: null } : { data: { id: PROMO }, error: null }))
    const res = await promosRouter.request('/', send('POST', create))
    expect(res.status).toBe(201)
    expect(mocks.consume).toHaveBeenCalledWith(identity)
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('releases the intent when the insert fails', async () => {
    mocks.from.mockImplementation((t: string) => builder(t === 'courses' ? { data: { id: TARGET }, error: null } : { data: null, error: { code: 'X' } }))
    const res = await promosRouter.request('/', send('POST', create))
    expect(res.status).toBe(500)
    expect(mocks.release).toHaveBeenCalledWith(identity)
  })

  it('does not insert when the intent was already used', async () => {
    const { StorageError } = await import('../storage/r2')
    mocks.consume.mockRejectedValue(Object.assign(new StorageError('used'), { code: 'UPLOAD_INTENT_USED', status: 409 }))
    mocks.from.mockImplementation((t: string) => builder(t === 'courses' ? { data: { id: TARGET }, error: null } : { data: { id: PROMO }, error: null }))
    const res = await promosRouter.request('/', send('POST', create))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'UPLOAD_INTENT_USED' })
  })

  it('consumes on image replacement and releases when the update fails', async () => {
    let call = 0
    mocks.from.mockImplementation(() => builder(++call === 1
      ? { data: { id: PROMO, image_key: 'k-old', link_type: 'course', link_id: TARGET }, error: null }
      : { data: null, error: { code: 'X' } }))
    const res = await promosRouter.request(`/${PROMO}`, send('PATCH', { image_key: 'k-new', content_type: 'image/png', file_size_bytes: 100 }))
    expect(res.status).toBe(500)
    expect(mocks.consume).toHaveBeenCalledWith(identity)
    expect(mocks.release).toHaveBeenCalledWith(identity)
  })
})

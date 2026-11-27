import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  download: vi.fn(async () => 'signed-download'),
  verify: vi.fn(async () => undefined),
  enqueue: vi.fn(),
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' } as any,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../jobs/storage-cleanup', () => ({ enqueueObjectDeletion: mocks.enqueue }))
vi.mock('../storage/r2', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, createPresignedDownload: mocks.download, verifyPrivateUpload: mocks.verify }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', { id: mocks.user.school_id, membershipId: 'm-1', role: mocks.user.role })
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Insufficient role', code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { notesRouter } from './notes'

const COURSE = '11111111-1111-4111-8111-111111111111'

function query(result: any, rangeSpy = vi.fn()) {
  const value: any = {
    select: () => value, eq: () => value, in: () => value, order: () => value, insert: () => value,
    range: (...args: any[]) => { rangeSpy(...args); return value },
    maybeSingle: async () => result, single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

function queue(...results: any[]) {
  const pending = [...results]
  mocks.from.mockImplementation(() => query(pending.shift() ?? { data: null, error: null }))
}

const fileKey = `schools/school-1/private/note/${COURSE}/abc.pdf`
const validBody = { title: 'Week 1', file_key: fileKey, file_name: 'w1.pdf', file_type: 'application/pdf', file_size_bytes: 1000 }

function create(body: unknown) {
  return notesRouter.request(`/${COURSE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('notes routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'admin' }
  })

  it('rejects oversized or malformed material metadata', async () => {
    expect((await create({ ...validBody, title: 'x'.repeat(201) })).status).toBe(400)
    expect((await create({ ...validBody, description: 'x'.repeat(2001) })).status).toBe(400)
    expect((await create({ ...validBody, file_size_bytes: 'big' })).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps a unique violation on file_key to 409 FILE_ALREADY_REGISTERED', async () => {
    queue({ data: { id: COURSE }, error: null }, { data: null, error: null }, { data: null, error: { code: '23505', message: 'dup' } })
    const response = await create(validBody)
    expect(response.status).toBe(409)
    expect((await response.json() as any).code).toBe('FILE_ALREADY_REGISTERED')
  })

  it('does not leak database error text on create failure', async () => {
    queue({ data: null, error: { message: 'relation secret_table missing' } })
    const response = await create(validBody)
    const text = await response.text()
    expect(response.status).toBe(500)
    expect(text).not.toContain('secret_table')
  })

  it('paginates the course list and signs only the returned page', async () => {
    const rangeSpy = vi.fn()
    // The route reads one extra row to learn whether another page exists.
    const rows = [{ id: 'n1', file_key: 'k1' }, { id: 'n2', file_key: 'k2' }, { id: 'n3', file_key: 'k3' }]
    mocks.from.mockImplementation(() => query({ data: rows, error: null }, rangeSpy))
    const response = await notesRouter.request(`/${COURSE}?page=2&page_size=2`)
    const body = await response.json() as any
    expect(response.status).toBe(200)
    expect(rangeSpy).toHaveBeenCalledWith(2, 4)
    expect(mocks.download).toHaveBeenCalledTimes(2)
    expect(body.data[0].file_key).toBeUndefined()
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({ page: 2, page_size: 2, has_more: true })
  })

  it('reports no further page when the total is an exact multiple of the page size', async () => {
    const rows = [{ id: 'n1', file_key: 'k1' }, { id: 'n2', file_key: 'k2' }]
    mocks.from.mockImplementation(() => query({ data: rows, error: null }, vi.fn()))
    const response = await notesRouter.request(`/${COURSE}?page=1&page_size=2`)
    expect((await response.json() as any).pagination.has_more).toBe(false)
  })

  it('rejects invalid pagination before querying notes', async () => {
    const response = await notesRouter.request(`/${COURSE}?page_size=101`)
    expect(response.status).toBe(400)
    expect(mocks.download).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, auth: { admin: {} } } }))
vi.mock('../storage/r2', () => ({ publicFileUrl: (key: string) => `https://media.test/${key}` }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { usersRouter } from './users'

describe('student import access and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('rejects non-admins before accessing student data', async () => {
    mocks.user.role = 'tutor'
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'ada@example.test', programme_id: 'programme-1' }] }),
    })

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a programme and a contact method before querying the database', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor' }] }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

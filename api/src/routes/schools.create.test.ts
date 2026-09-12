import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  insertedSlugs: [] as string[],
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById, updateUserById: mocks.updateUserById } },
  },
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', supabase_auth_id: 'auth-1', school_id: null, role: 'admin' })
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
}))

vi.mock('../emails/send-tutor-invitation', () => ({ sendTutorInvitation: vi.fn() }))

import { schoolsRouter } from './schools'

describe('POST /schools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedSlugs.length = 0
    let profileCall = 0
    let schoolInsert = 0

    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        profileCall += 1
        if (profileCall === 1) {
          const lookup: any = {
            select: () => lookup,
            eq: () => lookup,
            single: async () => ({ data: { school_id: null }, error: null }),
          }
          return lookup
        }
        const update: any = {
          update: () => update,
          eq: async () => ({ error: null }),
        }
        return update
      }

      if (table === 'schools') {
        const insert: any = {
          insert: (value: any) => {
            mocks.insertedSlugs.push(value.slug)
            return insert
          },
          select: () => insert,
          single: async () => {
            schoolInsert += 1
            return schoolInsert === 1
              ? { data: null, error: { code: '23505', message: 'duplicate slug' } }
              : { data: { id: 'school-1', name: 'Bright Future', slug: 'bright-future-2' }, error: null }
          },
        }
        return insert
      }

      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.getUserById.mockResolvedValue({ data: { user: { app_metadata: { role: 'admin' } } } })
    mocks.updateUserById.mockResolvedValue({ error: null })
  })

  it('selects the next generated link when the centre-name slug is taken', async () => {
    const response = await schoolsRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bright Future' }),
    })
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(mocks.insertedSlugs).toEqual(['bright-future', 'bright-future-2'])
    expect(body.school.slug).toBe('bright-future-2')
    expect(mocks.updateUserById).toHaveBeenCalledWith('auth-1', {
      app_metadata: { role: 'admin', school_id: 'school-1' },
    })
  })

  it('rejects a customised link that belongs to the application', async () => {
    const response = await schoolsRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'My Centre', slug: 'dashboard' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'RESERVED_SLUG' })
    expect(mocks.insertedSlugs).toEqual([])
  })
})

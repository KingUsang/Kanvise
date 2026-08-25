import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', () => ({ publicFileUrl: (key: string) => `https://media.test/${key}` }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('user').role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { studentSettingsRouter } from './student-settings'

function updateQuery(result: any, eqSpy: ReturnType<typeof vi.fn>) {
  const value: any = {
    update: (payload: unknown) => { value.payload = payload; return value },
    eq: (...args: unknown[]) => { eqSpy(...args); return value },
    select: () => value,
    maybeSingle: async () => result,
  }
  return value
}

describe('student settings security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
  })

  it('rejects non-students before reading profile data', async () => {
    mocks.user.role = 'tutor'
    const response = await studentSettingsRouter.request('/students/me/settings')
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not apply student middleware to unrelated routes', async () => {
    mocks.user.role = 'admin'
    const response = await studentSettingsRouter.request('/programmes/setup', { method: 'POST' })
    expect(response.status).toBe(404)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('ignores role, school and email supplied by the browser', async () => {
    const eqSpy = vi.fn()
    const builder = updateQuery({ data: {
      id: 'student-1', kanvise_user_id: 'KV-1', first_name: 'Ada', last_name: 'Okafor',
      email: 'ada@example.test', bio: null, profile_photo_key: null,
    }, error: null }, eqSpy)
    mocks.from.mockReturnValue(builder)

    const response = await studentSettingsRouter.request('/students/me/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: 'Ada', role: 'admin', school_id: 'school-2', email: 'hijack@example.test' }),
    })

    expect(response.status).toBe(200)
    expect(builder.payload).toEqual({ first_name: 'Ada' })
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-1')
    expect(eqSpy).toHaveBeenCalledWith('school_id', 'school-1')
    expect(eqSpy).toHaveBeenCalledWith('role', 'student')
  })
})

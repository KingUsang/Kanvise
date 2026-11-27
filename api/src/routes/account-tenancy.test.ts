import { beforeEach, describe, expect, it, vi } from 'vitest'

// The profile projection names a different account and role than the selected
// active membership. Every migrated router must follow the membership
// (DEV-SEC-004, DEV-SEC-005, DEV-API-007).
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  eqCalls: [] as Array<[string, unknown]>,
  profile: { id: 'person-1', school_id: 'profile-school', role: 'admin' } as any,
  account: { id: 'account-school', membershipId: 'membership-1', role: 'tutor' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: vi.fn() } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.profile); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', mocks.account); await next() },
  requireRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('user').role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { directAssignmentsRouter } from './direct-assignments'
import { liveClassesRouter } from './live-classes'
import { slidesRouter } from './slides'

function recordingBuilder(result: any) {
  const value: any = {
    select: () => value, order: () => value, in: () => value, range: () => value,
    eq: (column: string, expected: unknown) => { mocks.eqCalls.push([column, expected]); return value },
    maybeSingle: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('routers take tenant and role from the selected account membership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eqCalls.length = 0
    mocks.profile = { id: 'person-1', school_id: 'profile-school', role: 'admin' }
    mocks.account = { id: 'account-school', membershipId: 'membership-1', role: 'tutor' }
    mocks.from.mockImplementation(() => recordingBuilder({ data: [], error: null }))
  })

  it('lists live classes for the account and applies the membership role filter', async () => {
    const response = await liveClassesRouter.request('/')
    expect(response.status).toBe(200)
    expect(mocks.eqCalls).toContainEqual(['school_id', 'account-school'])
    expect(mocks.eqCalls).not.toContainEqual(['school_id', 'profile-school'])
    // A Tutor membership must be limited to that Tutor's own classes even when
    // the profile role says admin.
    expect(mocks.eqCalls).toContainEqual(['tutor_id', 'person-1'])
  })

  it('looks up slides classes in the active account and hides other-account classes as not found', async () => {
    mocks.from.mockImplementation(() => recordingBuilder({ data: null, error: null }))
    const response = await slidesRouter.request('/class-1/presentations')
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' })
    expect(mocks.eqCalls).toContainEqual(['school_id', 'account-school'])
    expect(mocks.eqCalls).not.toContainEqual(['school_id', 'profile-school'])
  })

  it('scopes direct assignments to the account and rejects a Learner membership despite an admin profile', async () => {
    const ok = await directAssignmentsRouter.request('/')
    expect(ok.status).toBe(200)
    expect(mocks.eqCalls).toContainEqual(['school_id', 'account-school'])
    expect(mocks.eqCalls).not.toContainEqual(['school_id', 'profile-school'])

    mocks.account = { id: 'account-school', membershipId: 'membership-1', role: 'learner' }
    const denied = await directAssignmentsRouter.request('/')
    expect(denied.status).toBe(403)
  })
})

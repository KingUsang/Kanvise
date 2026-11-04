import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  updateUserById: vi.fn(),
  filters: [] as Array<{ table: string; args: unknown[] }>,
  operations: [] as Array<{ type: string; values: unknown }>,
  user: { id: 'student-1', role: 'student', school_id: 'school-1' } as any,
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from, auth: { admin: { updateUserById: mocks.updateUserById } } },
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { studentMembershipsRouter } from './student-memberships'

function query(table: string, result: any) {
  const value: any = {
    select: vi.fn(() => value),
    eq: vi.fn((...args: unknown[]) => { mocks.filters.push({ table, args }); return value }),
    update: vi.fn((values: unknown) => { mocks.operations.push({ type: 'update', values }); return value }),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  return value
}

function configureSelection({ membership, school, profile = { data: { supabase_auth_id: 'auth-1' }, error: null }, profileUpdate = { error: null } }: any) {
  let profileQuery = 0
  mocks.from.mockImplementation((table: string) => {
    if (table === 'student_centre_memberships') return query(table, membership)
    if (table === 'schools') return query(table, school)
    if (table === 'user_profiles') return query(table, profileQuery++ === 0 ? profileUpdate : profile)
    throw new Error(`Unexpected table ${table}`)
  })
  mocks.updateUserById.mockResolvedValue({ error: null })
}

async function selectCentre() {
  return studentMembershipsRouter.request('/centres/school-2/select', { method: 'POST' })
}

describe('student centre selection safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.filters.length = 0
    mocks.operations.length = 0
    mocks.user = { id: 'student-1', role: 'student', school_id: 'school-1' }
  })

  it('selects an active centre for an active member', async () => {
    configureSelection({
      membership: { data: { id: 'membership-1' }, error: null },
      school: { data: { id: 'school-2' }, error: null },
    })

    const response = await selectCentre()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { school_id: 'school-2' } })
    expect(mocks.filters).toContainEqual({ table: 'schools', args: ['is_active', true] })
    expect(mocks.operations).toHaveLength(1)
    expect(mocks.updateUserById).toHaveBeenCalledWith('auth-1', { app_metadata: { school_id: 'school-2' } })
  })

  it('rejects an inactive or missing centre before any write', async () => {
    configureSelection({
      membership: { data: { id: 'membership-1' }, error: null },
      school: { data: null, error: null },
    })

    const response = await selectCentre()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' })
    expect(mocks.operations).toHaveLength(0)
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('rejects an inactive or missing membership before resolving the centre', async () => {
    configureSelection({
      membership: { data: null, error: null },
      school: { data: { id: 'school-2' }, error: null },
    })

    const response = await selectCentre()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('student_centre_memberships')
    expect(mocks.operations).toHaveLength(0)
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it.each([
    ['membership', { data: null, error: { message: 'membership lookup failed' } }, { data: { id: 'school-2' }, error: null }],
    ['centre', { data: { id: 'membership-1' }, error: null }, { data: null, error: { message: 'centre lookup failed' } }],
  ])('fails closed when the %s lookup fails', async (_name, membership, school) => {
    configureSelection({ membership, school })

    const response = await selectCentre()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Could not verify this centre', code: 'CENTRE_SELECTION_UNAVAILABLE' })
    expect(mocks.operations).toHaveLength(0)
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })
})

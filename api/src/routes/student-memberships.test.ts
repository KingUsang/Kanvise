import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  filters: [] as Array<{ table: string; args: unknown[] }>,
  operations: [] as Array<{ type: string; values: unknown }>,
  limits: [] as number[],
  orders: [] as Array<{ table: string; args: unknown[] }>,
  cursorFilters: [] as string[],
  user: { id: 'student-1', role: 'student', school_id: 'school-1' } as any,
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))
vi.mock('../middleware/auth', () => ({
  ACCOUNT_CONTEXT_HEADER: 'X-Kanvise-Account-Id',
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { studentMembershipsRouter } from './student-memberships'

function query(table: string, result: any) {
  const value: any = {
    select: vi.fn(() => value),
    eq: vi.fn((...args: unknown[]) => { mocks.filters.push({ table, args }); return value }),
    or: vi.fn((filter: string) => { mocks.cursorFilters.push(filter); return value }),
    order: vi.fn((...args: unknown[]) => { mocks.orders.push({ table, args }); return value }),
    limit: vi.fn((amount: number) => { mocks.limits.push(amount); return value }),
    update: vi.fn((values: unknown) => { mocks.operations.push({ type: 'update', values }); return value }),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  return value
}

function configureSelection({ membership, school }: any) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'account_memberships') return query(table, membership)
    if (table === 'schools') return query(table, school)
    throw new Error(`Unexpected table ${table}`)
  })
}

async function selectCentre() {
  return studentMembershipsRouter.request('/centres/school-2/select', { method: 'POST' })
}

describe('student centre selection safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.filters.length = 0
    mocks.operations.length = 0
    mocks.limits.length = 0
    mocks.orders.length = 0
    mocks.cursorFilters.length = 0
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
    expect(mocks.operations).toHaveLength(0)
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
    expect(mocks.from).toHaveBeenCalledWith('account_memberships')
    expect(mocks.operations).toHaveLength(0)
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
  })

  it('returns the default bounded membership page and compatible metadata', async () => {
    mocks.from.mockReturnValue(query('account_memberships', {
      data: [{ id: 'membership-1', school_id: 'school-1', role: 'learner', joined_at: '2026-01-01T00:00:00.000Z', school: { id: 'school-1', name: 'Home Centre' } }],
      error: null,
    }))

    const response = await studentMembershipsRouter.request('/centres')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: 'membership-1', school_id: 'school-1', active: true }],
      meta: { limit: 20, next_cursor: null },
    })
    expect(mocks.limits).toEqual([21])
  })

  it('honours a requested page size and fetches one extra row for continuation', async () => {
    mocks.from.mockReturnValue(query('account_memberships', {
      data: [
        { id: 'membership-1', school_id: 'school-1', role: 'learner', joined_at: '2026-01-01T00:00:00.000Z', school: { id: 'school-1', name: 'Home Centre' } },
        { id: 'membership-2', school_id: 'school-2', role: 'learner', joined_at: '2026-01-02T00:00:00.000Z', school: { id: 'school-2', name: 'Second Centre' } },
        { id: 'membership-3', school_id: 'school-3', role: 'learner', joined_at: '2026-01-03T00:00:00.000Z', school: { id: 'school-3', name: 'Third Centre' } },
      ],
      error: null,
    }))

    const response = await studentMembershipsRouter.request('/centres?limit=2')
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.meta.limit).toBe(2)
    expect(body.meta.next_cursor).toEqual(expect.any(String))
    expect(mocks.limits).toEqual([3])
  })

  it('continues from an opaque cursor without losing learner scope', async () => {
    const firstPage = query('account_memberships', {
      data: [
        { id: 'membership-1', school_id: 'school-1', role: 'learner', joined_at: '2026-01-01T00:00:00.000Z', school: { id: 'school-1', name: 'Home Centre' } },
        { id: 'membership-2', school_id: 'school-2', role: 'learner', joined_at: '2026-01-02T00:00:00.000Z', school: { id: 'school-2', name: 'Second Centre' } },
        { id: 'membership-3', school_id: 'school-3', role: 'learner', joined_at: '2026-01-03T00:00:00.000Z', school: { id: 'school-3', name: 'Third Centre' } },
      ],
      error: null,
    })
    const secondPage = query('account_memberships', {
      data: [{ id: 'membership-3', school_id: 'school-3', joined_at: '2026-01-03T00:00:00.000Z', school: { id: 'school-3', name: 'Third Centre' } }],
      error: null,
    })
    let requestCount = 0
    mocks.from.mockImplementation(() => requestCount++ === 0 ? firstPage : secondPage)

    const firstResponse = await studentMembershipsRouter.request('/centres?limit=2')
    const firstBody = await firstResponse.json() as any
    const secondResponse = await studentMembershipsRouter.request(`/centres?limit=2&cursor=${encodeURIComponent(firstBody.meta.next_cursor)}`)
    const secondBody = await secondResponse.json() as any

    expect(secondResponse.status).toBe(200)
    expect(secondBody.data.map((membership: any) => membership.id)).toEqual(['membership-3'])
    expect(mocks.cursorFilters).toHaveLength(1)
    expect(mocks.cursorFilters[0]).toContain('joined_at.gt.2026-01-02T00:00:00.000Z')
    expect(mocks.filters.filter(({ args }) => args[0] === 'person_id')).toEqual([
      { table: 'account_memberships', args: ['person_id', 'student-1'] },
      { table: 'account_memberships', args: ['person_id', 'student-1'] },
    ])
  })

  it('orders membership pages deterministically by joined time and id', async () => {
    mocks.from.mockReturnValue(query('account_memberships', { data: [], error: null }))

    const response = await studentMembershipsRouter.request('/centres')

    expect(response.status).toBe(200)
    expect(mocks.orders).toEqual([
      { table: 'account_memberships', args: ['joined_at', { ascending: true }] },
      { table: 'account_memberships', args: ['id', { ascending: true }] },
    ])
  })

  it.each(['/centres?limit=0', '/centres?limit=101', '/centres?limit=not-a-number', '/centres?cursor=not-a-valid-cursor'])('rejects malformed pagination input: %s', async path => {
    const response = await studentMembershipsRouter.request(path)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps membership lookup failure to a safe server error', async () => {
    mocks.from.mockReturnValue(query('account_memberships', { data: null, error: { message: 'database unavailable' } }))

    const response = await studentMembershipsRouter.request('/centres')

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Could not load your centres', code: 'CENTRES_UNAVAILABLE' })
  })
})

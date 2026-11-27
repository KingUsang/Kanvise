import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), accountRole: 'admin' as string }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', school_id: 'school-1', role: mocks.accountRole })
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', { id: 'school-1', membershipId: 'membership-1', role: mocks.accountRole })
    await next()
  },
}))

import { coursesRouter } from './courses'

function query(result: any, calls: Array<[string, ...any[]]>) {
  const builder: any = {
    select: (...args: any[]) => { calls.push(['select', ...args]); return builder },
    eq: (...args: any[]) => { calls.push(['eq', ...args]); return builder },
    is: (...args: any[]) => { calls.push(['is', ...args]); return builder },
    order: (...args: any[]) => { calls.push(['order', ...args]); return builder },
    range: (...args: any[]) => { calls.push(['range', ...args]); return builder },
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('course list filters', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.accountRole = 'admin' })

  it('rejects malformed boolean filters before querying', async () => {
    const response = await coursesRouter.request('/?standalone=yes')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('retains valid boolean filter behavior', async () => {
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockReturnValue(query({ data: [{ id: 'course-1' }], error: null }, calls))
    const response = await coursesRouter.request('/?standalone=true&is_published=false')
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['is', 'programme_id', null])
    expect(calls).toContainEqual(['is', 'sub_programme_id', null])
    expect(calls).toContainEqual(['eq', 'is_published', false])
    expect(calls).toContainEqual(['range', 0, 500])
    await expect(response.json()).resolves.toEqual({ data: [{ id: 'course-1' }], pagination: { limit: 500, offset: 0, has_more: false } })
  })

  it('rejects an unbounded page request', async () => {
    for (const qs of ['limit=0', 'limit=501', 'offset=-1']) {
      const response = await coursesRouter.request(`/?${qs}`)
      expect(response.status).toBe(400)
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a safe service error when Tutor assignment lookup fails', async () => {
    mocks.accountRole = 'tutor'
    mocks.from.mockImplementation((table: string) => table === 'tutor_course_assignments'
      ? query({ data: null, error: { message: 'private database detail', code: 'XX000' } }, [])
      : query({ data: [], error: null }, []))

    const response = await coursesRouter.request('/')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Could not resolve your subject access', code: 'SUBJECT_ACCESS_FAILED' })
    expect(JSON.stringify(body)).not.toContain('private database detail')
  })

  it('does not allow unsupported membership roles through the Subject router', async () => {
    mocks.accountRole = 'super_admin'
    const response = await coursesRouter.request('/')

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps a Subject lookup failure separately from a missing Subject', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'private database detail', code: 'XX000' } }, []))

    const response = await coursesRouter.request('/subject-1')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Could not load this subject', code: 'SUBJECT_READ_FAILED' })
    expect(JSON.stringify(body)).not.toContain('private database detail')
  })

  it('hides Subject tutor assignments from an unassigned Tutor', async () => {
    mocks.accountRole = 'tutor'
    let calls = 0
    mocks.from.mockImplementation((table: string) => {
      calls += 1
      if (table === 'courses') return query({ data: { id: 'subject-1' }, error: null }, [])
      return query({ data: null, error: { code: 'PGRST116' } }, [])
    })

    const response = await coursesRouter.request('/subject-1/tutors')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' })
    expect(calls).toBe(2)
  })
})

describe('subject PATCH allow-list', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.accountRole = 'admin' })

  function patch(body: unknown) {
    return coursesRouter.request('/11111111-1111-4111-8111-111111111111', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  it.each([
    ['school_id', { school_id: 'other' }],
    ['created_by', { created_by: 'x' }],
    ['is_published', { is_published: true }],
    ['id', { id: 'x' }],
    ['unknown column', { name: 'A', nope: 1 }],
  ])('rejects %s with 400 and does not write', async (_l, body) => {
    const response = await patch(body)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_SUBJECT_UPDATE' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forwards exactly the fields the web builder sends', async () => {
    const update = vi.fn()
    mocks.from.mockImplementation(() => {
      const b: any = query({ data: { id: 'c1' }, error: null }, [])
      b.update = (u: any) => { update(u); return b }
      return b
    })
    const payload = { name: 'Maths', slug: 'maths', description: 'd', programme_id: null, price: 0, currency: 'NGN', is_available_separately: false, sort_order: 2 }
    const response = await patch(payload)
    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(payload)
  })

  it('rejects a parent from another account', async () => {
    mocks.from.mockImplementation(() => query({ data: null, error: null }, []))
    const response = await patch({ programme_id: '22222222-2222-4222-8222-222222222222' })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_PARENT' })
  })
})

describe('subject create and delete contract', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.accountRole = 'admin' })
  const create = (body: unknown) => coursesRouter.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  it('rejects loosely typed or unknown create fields before any query', async () => {
    for (const body of [
      { name: 123, slug: 'maths' },
      { name: 'Maths', slug: 'Maths Upper' },
      { name: 'Maths', slug: 'maths', price: '12abc' },
      { name: 'Maths', slug: 'maths', currency: 'naira' },
      { name: 'Maths', slug: 'maths', is_published: true },
      { name: 'Maths', slug: 'maths', programme_id: 'not-a-uuid' },
    ]) {
      const response = await create(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps a parent lookup failure to a service error, not INVALID_PARENT', async () => {
    mocks.from.mockImplementation(() => query({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }, []))
    const response = await create({ name: 'Maths', slug: 'maths', programme_id: '22222222-2222-4222-8222-222222222222' })
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: 'Could not create this subject', code: 'SUBJECT_CREATE_FAILED' })
  })

  it('stores a canonical numeric price', async () => {
    const insert = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      const b: any = query(table === 'courses' && insert.mock.calls.length > 0 ? { data: { id: 'c1' }, error: null } : { data: null, error: null }, [])
      b.insert = (row: any) => { insert(row); return query({ data: { id: 'c1' }, error: null }, []) }
      return b
    })
    const response = await create({ name: 'Maths', slug: 'maths', price: '1500.50', currency: 'NGN' })
    expect(response.status).toBe(201)
    expect(insert.mock.calls[0][0]).toMatchObject({ price: 1500.5, currency: 'NGN', is_available_separately: true })
  })

  it('reports an absent subject on delete instead of success', async () => {
    mocks.from.mockImplementation(() => {
      const b: any = query({ data: [], error: null }, [])
      b.delete = () => b
      return b
    })
    const response = await coursesRouter.request('/22222222-2222-4222-8222-222222222222', { method: 'DELETE' })
    expect(response.status).toBe(404)
  })
})


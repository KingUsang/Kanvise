import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
}))

import { subProgrammesRouter } from './sub-programmes'

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('DELETE /sub-programmes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('blocks deletion when an enrolment inherits access through the parent programme', async () => {
    const enrolmentQuery = query({ data: { id: 'enrolment-1' }, error: null })
    const deleteQuery = query({ data: { id: 'sub-1' }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'sub_programmes') {
        return mocks.from.mock.calls.filter(([name]) => name === 'sub_programmes').length === 1
          ? query({ data: { id: 'sub-1', programme_id: 'programme-1' }, error: null })
          : deleteQuery
      }
      if (table === 'courses') return query({ data: [{ id: 'course-1' }], error: null })
      if (table === 'enrolments') return enrolmentQuery
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await subProgrammesRouter.request('/sub-1', { method: 'DELETE' })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'ACTIVE_ENROLMENTS' })
    expect(enrolmentQuery.or).toHaveBeenCalledWith(
      'sub_programme_id.eq.sub-1,programme_id.eq.programme-1,course_id.in.(course-1)',
    )
    expect(deleteQuery.delete).not.toHaveBeenCalled()
  })

  it('deletes an empty sub-programme within the current school', async () => {
    let subProgrammeCalls = 0
    const deleteQuery = query({ data: { id: 'sub-1' }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'sub_programmes') {
        subProgrammeCalls += 1
        return subProgrammeCalls === 1
          ? query({ data: { id: 'sub-1', programme_id: null }, error: null })
          : deleteQuery
      }
      if (table === 'courses') return query({ data: [], error: null })
      if (table === 'enrolments') return query({ data: null, error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await subProgrammesRouter.request('/sub-1', { method: 'DELETE' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'Sub-programme deleted' })
    expect(deleteQuery.delete).toHaveBeenCalledOnce()
    expect(deleteQuery.eq).toHaveBeenCalledWith('school_id', 'school-1')
  })

  it('returns not found without checking enrolments for another school', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'sub_programmes') return query({ data: null, error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await subProgrammesRouter.request('/sub-other', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})

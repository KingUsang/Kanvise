import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { coursesRouter } from './courses'

function query(result: any) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    or: () => builder,
    in: () => builder,
    order: () => builder,
    single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('course tutor management', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a school-wide assignment overview without per-course queries', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'courses') return query({ data: [{ id: 'course-1', name: 'Chemistry', is_published: true }], error: null })
      if (table === 'tutor_course_assignments') return query({ data: [{ course_id: 'course-1', tutor_id: 'tutor-1' }], error: null })
      if (table === 'user_profiles') return query({ data: [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Okafor', role: 'tutor' }], error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await coursesRouter.request('/assignment-overview')
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data[0].tutors).toEqual([expect.objectContaining({ id: 'tutor-1' })])
    expect(mocks.from).toHaveBeenCalledTimes(3)
  })

  it('rejects assignment when the course is outside the admin school', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'courses') return query({ data: null, error: { code: 'PGRST116' } })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await coursesRouter.request('/course-other/tutors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tutor_id: 'KNV-TUT-1' }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'COURSE_NOT_FOUND' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})

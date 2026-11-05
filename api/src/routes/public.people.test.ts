import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', () => ({ publicFileUrl: (key: string) => `https://media.test/${key}` }))

import { publicRouter } from './public'

function query(result: unknown) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

describe('public tutoring-account people projections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not present inactive Tutors as current public instructors', async () => {
    let profileQuery: any
    mocks.from.mockImplementation((table: string) => {
      if (table === 'schools') return query({ data: { id: 'school-1', name: 'Bright Future', slug: 'bright-future', is_active: true }, error: null })
      if (table === 'programmes' || table === 'courses') return query({ data: [], error: null })
      if (table === 'user_profiles') return (profileQuery = query({ data: [{ id: 'tutor-active', first_name: 'Ada', last_name: 'Okafor', bio: null, role: 'tutor' }], error: null }))
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await publicRouter.request('/schools/bright-future')

    expect(response.status).toBe(200)
    expect((await response.json()).data.tutors).toEqual([{ id: 'tutor-active', first_name: 'Ada', last_name: 'Okafor', bio: null, role: 'tutor' }])
    expect(profileQuery.eq).toHaveBeenCalledWith('is_active', true)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { publicRouter } from './public'

function query(result: unknown) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: async () => result,
    maybeSingle: async () => result,
  }
  return chain
}

describe('GET /public/schools/:slug historical links', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the current slug when a shared centre link has changed', async () => {
    let schoolLookup = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'schools') {
        schoolLookup += 1
        return schoolLookup === 1
          ? query({ data: null, error: { code: 'PGRST116' } })
          : query({ data: { slug: 'bright-future' }, error: null })
      }
      if (table === 'school_slug_redirects') {
        return query({ data: { school_id: 'school-1' }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await publicRouter.request('/schools/old-bright-future')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ redirect_slug: 'bright-future' })
  })
})

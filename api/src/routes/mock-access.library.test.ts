import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'student-1', role: 'student', school_id: null as string | null },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { mockAccessRouter } from './mock-access'

function query(result: unknown) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('standalone mock library', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.school_id = null })

  it('returns the current attempt so a consumed allowance can still be resumed', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'mock_entitlements') return query({ data: [{
        id: 'entitlement-1', attempts_granted: 1, attempts_consumed: 1, offer: { id: 'offer-1' },
      }], error: null })
      if (table === 'mock_attempts') return query({ data: [{
        id: 'attempt-1', entitlement_id: 'entitlement-1', status: 'in_progress', started_at: '2026-09-09T10:00:00Z', deadline_at: null,
      }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await mockAccessRouter.request('/my-mocks')

    expect(response.status).toBe(200)
    const body: any = await response.json()
    expect(body.data[0].current_attempt).toMatchObject({ id: 'attempt-1', status: 'in_progress' })
  })

  it('uses centre attempts when an enrolled student enters through a public link', async () => {
    mocks.user.school_id = 'school-1'
    mocks.from.mockImplementation((table: string) => {
      if (table === 'mock_access_offers') return query({ data: {
        id: 'offer-1', school_id: 'school-1', mock_exam_id: 'mock-1', audience_scope: 'public_link',
        access_mode: 'paid', is_active: true, available_from: null, closes_at: null,
      }, error: null })
      if (table === 'mock_exams') return query({ data: {
        id: 'mock-1', school_id: 'school-1', audience_scope: 'course', course_id: 'course-1', programme_id: null, sections: [],
      }, error: null })
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.rpc.mockResolvedValue({ data: [{ attempt_id: 'centre-attempt-1' }], error: null })

    const response = await mockAccessRouter.request('/mock/offer-1/attempts', { method: 'POST' })

    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('start_or_resume_versioned_mock_attempt', expect.objectContaining({
      p_school_id: 'school-1', p_mock_exam_id: 'mock-1', p_student_id: 'student-1',
    }))
    expect(mocks.rpc).not.toHaveBeenCalledWith('start_or_resume_mock_offer_attempt', expect.anything())
  })
})

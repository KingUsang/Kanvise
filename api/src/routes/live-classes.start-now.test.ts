import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), ensureReady: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor', first_name: 'Ada' }); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../plugnmeet/classroom-lifecycle', () => ({ ensurePlugNmeetReady: mocks.ensureReady, isPlugNmeetHealthy: vi.fn() }))

import { liveClassesRouter } from './live-classes'

function chain(result: any) {
  const value: any = { select: () => value, insert: () => value, update: () => value, delete: () => value, eq: () => value, maybeSingle: async () => result, single: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) }
  return value
}

describe('POST /live-classes/start-now', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.ensureReady.mockResolvedValue({ state: 'preparing' }) })

  it('keeps the new class while the PlugNmeet classroom wakes', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      if (table === 'live_classes') return chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
      throw new Error(`Unexpected table: ${table}`)
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ data: { id: 'class-1', state: 'preparing', class_title: 'Mathematics class' } })
  })
})

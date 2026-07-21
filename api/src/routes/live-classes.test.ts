import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    // Default to admin, but tests can override by modifying c.set
    if (!c.get('user')) {
      c.set('user', { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1' })
    }
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { liveClassesRouter } from './live-classes'

function builder(result: any) {
  const value: any = {
    select: () => value, insert: () => value, eq: () => value,
    maybeSingle: async () => result, single: async () => result,
  }
  return value
}

describe('live classes API - scheduling', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('allows an admin to schedule a class for an eligible tutor', async () => {
    // Admin user is injected by the mocked middleware
    mocks.from.mockReturnValue(builder({ data: { id: 'class-1', status: 'scheduled' }, error: null }))
    
    const response = await liveClassesRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1',
        tutor_id: 'tutor-1',
        title: 'Math 101',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        duration_minutes: 60
      }),
    })
    
    expect(response.status).toBe(201)
    expect(mocks.from).toHaveBeenCalledWith('live_classes')
  })

  it('allows a tutor to schedule a class for themselves', async () => {
    mocks.from.mockReturnValue(builder({ data: { id: 'class-1', status: 'scheduled' }, error: null }))
    
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1',
        tutor_id: 'tutor-1', // Tutor is scheduling for themselves
        title: 'Math 101',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 60
      }),
    })
    
    // We override the user in the context for this specific request
    const response = await liveClassesRouter.request(req, {}, {
      user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor', kanvise_user_id: 'KNV-TUT-1' }
    } as any)
    
    // Currently this will pass, but the test ensures it remains working once hardened
    expect(response.status).toBe(201)
  })

  it('prevents a tutor from scheduling a class for another tutor', async () => {
    // This test will fail until the API is hardened!
    mocks.from.mockReturnValue(builder({ data: null, error: null }))
    
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1',
        tutor_id: 'tutor-2', // Tutor 1 trying to schedule Tutor 2
        title: 'Math 101',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 60
      }),
    })
    
    const response = await liveClassesRouter.request(req, {}, {
      user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    } as any)
    
    expect(response.status).toBe(403)
  })

  it('rejects classes scheduled in the past', async () => {
    const response = await liveClassesRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1',
        tutor_id: 'tutor-1',
        title: 'Math 101',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        duration_minutes: 60
      }),
    })
    
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('SCHEDULED_IN_PAST')
  })

  it('rejects durations less than 15 minutes', async () => {
    const response = await liveClassesRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1',
        tutor_id: 'tutor-1',
        title: 'Math 101',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 10 // Invalid duration
      }),
    })
    
    expect(response.status).toBe(400)
    // This expects the API to be hardened to check durations!
  })

  it('rejects durations more than 240 minutes', async () => {
    const response = await liveClassesRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1',
        tutor_id: 'tutor-1',
        title: 'Math 101',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 300 // Invalid duration
      }),
    })
    
    expect(response.status).toBe(400)
  })

  it('rejects missing fields', async () => {
    const response = await liveClassesRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Math 101'
      }),
    })
    
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('MISSING_FIELDS')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1' } as any,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { liveClassesRouter } from './live-classes'

function builder(result: any) {
  const value: any = {
    select: () => value, insert: () => value, update: () => value, eq: () => value,
    in: () => value, order: () => value,
    maybeSingle: async () => result, single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('live classes API - scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1' }
  })

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
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor', kanvise_user_id: 'KNV-TUT-1' }
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
    const response = await liveClassesRouter.request(req)
    
    // Currently this will pass, but the test ensures it remains working once hardened
    expect(response.status).toBe(201)
  })

  it('prevents a tutor from scheduling a class for another tutor', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
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
    
    const response = await liveClassesRouter.request(req)
    
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

describe('live classes API - student access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
  })

  it('limits a student class list to courses covered by their enrolments', async () => {
    const courseFilter = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'enrolments') return builder({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'courses') return builder({ data: [
        { id: 'course-1', programme_id: null, sub_programme_id: null },
        { id: 'course-2', programme_id: null, sub_programme_id: null },
      ], error: null })
      if (table === 'sub_programmes') return builder({ data: [], error: null })
      const query = builder({ data: [{ id: 'class-1', course_id: 'course-1' }], error: null })
      query.in = (column: string, values: string[]) => { courseFilter(column, values); return query }
      return query
    })

    const response = await liveClassesRouter.request(new Request('http://localhost/'))

    expect(response.status).toBe(200)
    expect(courseFilter).toHaveBeenCalledWith('course_id', ['course-1'])
  })

  it('hides a single class when the student is not enrolled', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'live_classes') return builder({ data: { id: 'class-2', course_id: 'course-2' }, error: null })
      if (table === 'enrolments') return builder({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'courses') return builder({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }, { id: 'course-2', programme_id: null, sub_programme_id: null }], error: null })
      return builder({ data: [], error: null })
    })

    const response = await liveClassesRouter.request(new Request('http://localhost/class-2'))
    expect(response.status).toBe(404)
  })

  it('prevents an unenrolled student from joining a live class', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'live_classes') return builder({ data: { id: 'class-2', course_id: 'course-2', status: 'live' }, error: null })
      if (table === 'enrolments') return builder({ data: [], error: null })
      if (table === 'courses') return builder({ data: [{ id: 'course-2', programme_id: null, sub_programme_id: null }], error: null })
      return builder({ data: [], error: null })
    })

    const response = await liveClassesRouter.request(new Request('http://localhost/class-2/join', { method: 'POST' }))
    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_ENROLLED')
  })
})

describe('live classes API - editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents a tutor from editing another tutor’s class', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.from.mockReturnValue(builder({
      data: {
        status: 'scheduled',
        tutor_id: 'tutor-2',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Changed title' }),
    })

    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_CLASS_TUTOR')
  })
})

describe('live classes API - host permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('does not let an unassigned admin join a tutor classroom', async () => {
    mocks.from.mockReturnValue(builder({
      data: { id: 'class-1', course_id: 'course-1', tutor_id: 'tutor-1', status: 'live', livekit_room_name: 'room-1' },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1/join', { method: 'POST' })

    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_CLASS_TUTOR')
  })

  it('does not let an unassigned admin end a tutor classroom', async () => {
    mocks.from.mockReturnValue(builder({
      data: { id: 'class-1', tutor_id: 'tutor-1', status: 'live', livekit_room_name: 'room-1' },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1/end', { method: 'POST' })

    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_CLASS_TUTOR')
  })
})

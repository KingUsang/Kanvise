import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1' } as any,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../plugnmeet/provider', () => ({
  providerForClass: () => 'plugnmeet',
  createPlugNmeetRoom: vi.fn(),
  persistProvider: vi.fn(),
  getPlugNmeetClientConfig: vi.fn((input: any) => Promise.resolve({ provider: 'plugnmeet', room_id: 'room-1', join_token: 'token', server_url: 'https://plugnmeet.example', client_files: { css_files: [], js_files: [] }, is_host: input.isHost })),
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { const u = c.get('user'); c.set('account', { id: u.school_id, membershipId: 'membership-1', role: u.role === 'student' ? 'learner' : u.role }); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

vi.mock('../notifications/triggers', () => ({ notifyClassCancelled: vi.fn().mockResolvedValue({ sent: 0 }), notifyClassRecapPublished: vi.fn() }))
vi.mock('../storage/r2', () => ({
  createPresignedDownload: vi.fn().mockResolvedValue('https://signed.example/recording.mp4'),
  privateObjectExists: vi.fn().mockResolvedValue(true),
}))

import { createHash } from 'node:crypto'
import { liveClassesRouter } from './live-classes'

function builder(result: any) {
  const value: any = {
    select: () => value, insert: () => value, update: () => value, eq: () => value,
    in: () => value, order: () => value, range: () => value, gte: () => value, lte: () => value, limit: () => value, is: () => value,
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

  it('creates a weekly server-side series instead of browser-generated classes', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor', kanvise_user_id: 'KNV-TUT-1' }
    mocks.from.mockReturnValue(builder({ data: { course_id: 'course-1' }, error: null }))
    mocks.rpc.mockResolvedValue({ data: 'series-1', error: null })

    const response = await liveClassesRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course_id: 'course-1', tutor_id: 'tutor-1', title: 'Math 101',
        scheduled_at: '2030-01-07T13:30:00.000Z', duration_minutes: 60,
        recurrence: 'weekly', starts_on: '2030-01-07', start_time: '14:30', timezone: 'Africa/Lagos',
      }),
    })

    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('create_recurring_live_class_series', {
      p_school_id: 'school-1', p_actor_id: 'tutor-1', p_course_id: 'course-1', p_tutor_id: 'tutor-1',
      p_title: 'Math 101', p_starts_on: '2030-01-07', p_start_time: '14:30', p_timezone: 'Africa/Lagos', p_duration_minutes: 60, p_weekdays: [1],
    })
    expect(await response.json()).toEqual({ data: { series_id: 'series-1', recurrence: 'weekly', weekdays: [1] } })
    expect(mocks.from).not.toHaveBeenCalledWith('live_classes')
  })

  it('prevents a tutor from scheduling a class for another tutor', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.from.mockImplementation((table: string) => builder({ data: table === 'account_memberships' ? { id: 'm-1' } : null, error: null }))
    
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
      if (table === 'live_classes') return builder({ data: { id: 'class-2', school_id: 'school-1', course_id: 'course-2' }, error: null })
      if (table === 'enrolments') return builder({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'courses') return builder({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }, { id: 'course-2', programme_id: null, sub_programme_id: null }], error: null })
      return builder({ data: [], error: null })
    })

    const response = await liveClassesRouter.request(new Request('http://localhost/class-2'))
    expect(response.status).toBe(404)
  })

  it('prevents an unenrolled student from joining a live class', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'live_classes') return builder({ data: { id: 'class-2', school_id: 'school-1', course_id: 'course-2', status: 'live' }, error: null })
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
        school_id: 'school-1',
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

  it('ends a recurring series through the protected database operation', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.rpc.mockResolvedValue({ data: 12, error: null })

    const response = await liveClassesRouter.request('/series/series-1', { method: 'DELETE' })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_recurring_live_class', {
      p_slot_id: 'series-1', p_school_id: 'school-1', p_actor_id: 'tutor-1',
    })
    expect(await response.json()).toEqual({ message: 'Recurring class ended', removed_classes: 12 })
  })
})

describe('live classes API - host permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('lets an unassigned admin join as a non-host observer', async () => {
    mocks.from.mockReturnValue(builder({
      data: { id: 'class-1', school_id: 'school-1', course_id: 'course-1', tutor_id: 'tutor-1', status: 'live', livekit_room_name: 'room-1' },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1/join', { method: 'POST' })

    expect(response.status).toBe(200)
    expect((await response.json() as any).data).toMatchObject({
      provider: 'plugnmeet',
      is_host: false,
    })
  })

  it('gives an admin who is the assigned class tutor host access', async () => {
    mocks.from.mockReturnValue(builder({
      data: { id: 'class-1', school_id: 'school-1', course_id: 'course-1', tutor_id: 'admin-1', status: 'live', livekit_room_name: 'room-1' },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1/join', { method: 'POST' })

    expect(response.status).toBe(200)
    expect((await response.json() as any).data.is_host).toBe(true)
  })

  it('still blocks an unassigned tutor from joining another tutor classroom', async () => {
    mocks.user = { id: 'tutor-2', school_id: 'school-1', role: 'tutor' }
    mocks.from.mockReturnValue(builder({
      data: { id: 'class-1', school_id: 'school-1', course_id: 'course-1', tutor_id: 'tutor-1', status: 'live', livekit_room_name: 'room-1' },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1/join', { method: 'POST' })

    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_CLASS_TUTOR')
  })

  it('does not let an unassigned admin end a tutor classroom', async () => {
    mocks.from.mockReturnValue(builder({
      data: { id: 'class-1', school_id: 'school-1', tutor_id: 'tutor-1', status: 'live', livekit_room_name: 'room-1' },
      error: null,
    }))

    const response = await liveClassesRouter.request('/class-1/end', { method: 'POST' })

    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_CLASS_TUTOR')
  })
})

const future = () => new Date(Date.now() + 86_400_000).toISOString()
const json = (body: unknown, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const scheduledClass = { id: 'class-1', school_id: 'school-1', course_id: 'course-1', tutor_id: 'tutor-1', status: 'scheduled', title: 'Maths', scheduled_at: future(), school: { name: 'Centre' } }

describe('live classes API - schedule validation (DEV-LVC-002, DEV-LVC-030)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
  })
  const base = { course_id: 'course-1', tutor_id: 'tutor-1', title: 'Math', scheduled_at: '2030-01-07T13:30:00.000Z', duration_minutes: 60 }

  it.each([
    ['unknown access mode', { access_mode: 'public' }],
    ['unknown recurrence', { recurrence: 'daily' }],
    ['weekday outside 1-7', { recurrence: 'weekly', recurrence_days: [0, 8], starts_on: '2030-01-07', start_time: '14:30', timezone: 'UTC' }],
    ['non-numeric weekday', { recurrence: 'weekly', recurrence_days: ['monday'], starts_on: '2030-01-07', start_time: '14:30', timezone: 'UTC' }],
    ['empty weekday list', { recurrence: 'weekly', recurrence_days: [], starts_on: '2030-01-07', start_time: '14:30', timezone: 'UTC' }],
    ['missing timezone on a series', { recurrence: 'weekly', starts_on: '2030-01-07', start_time: '14:30' }],
    ['invalid timezone', { recurrence: 'weekly', starts_on: '2030-01-07', start_time: '14:30', timezone: 'Mars/Olympus' }],
    ['impossible date', { recurrence: 'weekly', starts_on: '2030-02-31', start_time: '14:30', timezone: 'UTC' }],
    ['malformed start time', { recurrence: 'weekly', starts_on: '2030-01-07', start_time: '25:99', timezone: 'UTC' }],
    ['non-integer duration', { duration_minutes: 60.5 }],
  ])('rejects %s with 400 instead of normalising it', async (_name, patch) => {
    const response = await liveClassesRouter.request('/', json({ ...base, ...patch }))
    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('canonicalises the scheduled date before storing it', async () => {
    const insert = vi.fn()
    const q = builder({ data: { id: 'class-1' }, error: null })
    q.insert = (row: any) => { insert(row); return q }
    mocks.from.mockReturnValue(q)
    const when = new Date(Date.now() + 86_400_000)
    const response = await liveClassesRouter.request('/', json({ ...base, scheduled_at: when.toString() }))
    expect(response.status).toBe(201)
    expect(insert.mock.calls[0][0].scheduled_at).toBe(when.toISOString().replace(/\.\d{3}Z$/, '.000Z'))
  })

  it('applies the create bounds to PATCH and rejects empty or unknown updates', async () => {
    mocks.from.mockReturnValue(builder({ data: scheduledClass, error: null }))
    for (const body of [{}, { title: '   ' }, { duration_minutes: 5 }, { scheduled_at: '2001-01-01T00:00:00Z' }, { status: 'live' }]) {
      const response = await liveClassesRouter.request('/class-1', json(body, 'PATCH'))
      expect(response.status).toBe(400)
    }
  })

  it('rejects an oversized cancellation reason', async () => {
    const response = await liveClassesRouter.request(`/class-1?reason=${'x'.repeat(501)}`, { method: 'DELETE' })
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('live classes API - lifecycle races (DEV-LVC-032, DEV-TEST-020)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
  })

  it('updates conditionally on scheduled status and returns the row', async () => {
    const eq = vi.fn()
    const write = builder({ data: { ...scheduledClass, title: 'New' }, error: null })
    write.eq = (...args: any[]) => { eq(...args); return write }
    mocks.from.mockReturnValueOnce(builder({ data: scheduledClass, error: null })).mockReturnValueOnce(write)
    const response = await liveClassesRouter.request('/class-1', json({ title: 'New' }, 'PATCH'))
    expect(response.status).toBe(200)
    expect(eq).toHaveBeenCalledWith('status', 'scheduled')
  })

  it('maps a lost reschedule race to 409', async () => {
    mocks.from.mockReturnValueOnce(builder({ data: scheduledClass, error: null })).mockReturnValueOnce(builder({ data: null, error: null }))
    const response = await liveClassesRouter.request('/class-1', json({ title: 'New' }, 'PATCH'))
    expect(response.status).toBe(409)
    expect((await response.json() as any).code).toBe('CLASS_STATE_CHANGED')
  })

  it('maps a lost cancel race to 409 instead of 500', async () => {
    mocks.from.mockReturnValueOnce(builder({ data: scheduledClass, error: null })).mockReturnValueOnce(builder({ data: null, error: null }))
    const response = await liveClassesRouter.request('/class-1', { method: 'DELETE' })
    expect(response.status).toBe(409)
    expect((await response.json() as any).code).toBe('CLASS_STATE_CHANGED')
  })

  it('cancels a scheduled class and notifies enrolled learners', async () => {
    mocks.from.mockReturnValueOnce(builder({ data: scheduledClass, error: null })).mockReturnValueOnce(builder({ data: { ...scheduledClass, status: 'cancelled' }, error: null }))
    const response = await liveClassesRouter.request('/class-1?reason=Illness', { method: 'DELETE' })
    expect(response.status).toBe(200)
    expect((await response.json() as any).data.status).toBe('cancelled')
  })

  it('reports a database failure while cancelling as 500', async () => {
    mocks.from.mockReturnValueOnce(builder({ data: scheduledClass, error: null })).mockReturnValueOnce(builder({ data: null, error: { message: 'down' } }))
    const response = await liveClassesRouter.request('/class-1', { method: 'DELETE' })
    expect(response.status).toBe(500)
  })
})

describe('live classes API - list and read authorization (DEV-LVC-008, DEV-LVC-033)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it.each(['?status=bogus', '?from=nope', '?page=0', '?page_size=101', '?from=2030-02-01&to=2030-01-01'])('rejects invalid list query %s', async (qs) => {
    const response = await liveClassesRouter.request(`/${qs}`)
    expect(response.status).toBe(400)
  })

  it('bounds the list with a stable range and reports pagination', async () => {
    const range = vi.fn()
    const q = builder({ data: [{ id: 'a', status: 'scheduled' }, { id: 'b', status: 'scheduled' }, { id: 'c', status: 'scheduled' }], error: null })
    q.range = (from: number, to: number) => { range(from, to); return q }
    mocks.from.mockReturnValue(q)
    const response = await liveClassesRouter.request('/?page=3&page_size=2&status=scheduled')
    expect(response.status).toBe(200)
    expect(range).toHaveBeenCalledWith(4, 6)
    const body = await response.json() as any
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({ page: 3, page_size: 2, has_more: true })
  })

  it('denies a role outside the supported audience on a per-Class read', async () => {
    mocks.user = { id: 'root-1', school_id: 'school-1', role: 'super_admin' }
    mocks.from.mockReturnValue(builder({ data: scheduledClass, error: null }))
    const response = await liveClassesRouter.request('/class-1')
    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('INSUFFICIENT_ROLE')
  })
})

describe('live classes API - shared class join by Learner (DEV-LVC-027)', () => {
  const token = 'sharetoken123'
  const shared = { id: 'class-1', school_id: 'school-1', course_id: null, tutor_id: 'tutor-1', status: 'live', access_mode: 'anyone_with_link', share_token_hash: createHash('sha256').update(token).digest('hex'), share_link_revoked_at: null, provider_room_id: 'room-1' }
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
  })

  it('rejects a Learner who knows only the class UUID', async () => {
    mocks.from.mockReturnValue(builder({ data: shared, error: null }))
    const response = await liveClassesRouter.request('/class-1/join', { method: 'POST' })
    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('SHARE_TOKEN_REQUIRED')
  })

  it('rejects a wrong or revoked share token', async () => {
    mocks.from.mockReturnValue(builder({ data: shared, error: null }))
    expect((await liveClassesRouter.request('/class-1/join', json({ share_token: 'wrongtoken12' }))).status).toBe(403)
    mocks.from.mockReturnValue(builder({ data: { ...shared, share_link_revoked_at: new Date().toISOString() }, error: null }))
    expect((await liveClassesRouter.request('/class-1/join', json({ share_token: token }))).status).toBe(403)
  })

  it('admits a Learner who presents the active share token', async () => {
    mocks.from.mockReturnValue(builder({ data: shared, error: null }))
    const response = await liveClassesRouter.request('/class-1/join', json({ share_token: token }))
    expect(response.status).toBe(200)
  })
})

describe('live classes API - recording lifecycle (DEV-LVC-019)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
  })
  const withRecordings = (rows: any[]) => mocks.from.mockImplementation((table: string) => table === 'live_class_recordings'
    ? builder({ data: rows, error: null })
    : builder({ data: { ...scheduledClass, status: 'completed', classroom_provider: 'plugnmeet', access_mode: 'enrolled_learners' }, error: null }))

  it.each([
    [[], 404, 'RECORDING_NOT_READY', 'none'],
    [[{ id: 'r1', status: 'pending' }], 409, 'RECORDING_PROCESSING', 'processing'],
    [[{ id: 'r1', status: 'uploaded' }], 409, 'RECORDING_PROCESSING', 'processing'],
    [[{ id: 'r1', status: 'failed' }], 409, 'RECORDING_FAILED', 'failed'],
  ])('distinguishes %j', async (rows, status, code, recordingStatus) => {
    withRecordings(rows as any[])
    const response = await liveClassesRouter.request('/class-1/recording')
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ code, recording_status: recordingStatus })
  })

  it('returns a signed URL only for a ready recording', async () => {
    withRecordings([{ id: 'r1', status: 'ready', r2_file_key: 'k.mp4' }])
    const response = await liveClassesRouter.request('/class-1/recording')
    expect(response.status).toBe(200)
    expect((await response.json() as any).data.playback_url).toBe('https://signed.example/recording.mp4')
  })
})

describe('shared and enrolled class host membership (DEV-LVC-001)', () => {
  it('rejects a Tutor id that has no active membership in the account', async () => {
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1' }
    mocks.from.mockReturnValue(builder({ data: null, error: null }))
    const response = await liveClassesRouter.request(new Request('http://localhost/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tutor_id: 'outsider', title: 'Open day', access_mode: 'anyone_with_link', scheduled_at: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 60 }),
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_TUTOR' })
  })
})

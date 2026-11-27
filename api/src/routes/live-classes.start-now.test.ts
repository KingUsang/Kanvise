import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ admission: vi.fn(), from: vi.fn(), ensureReady: vi.fn(), createRoom: vi.fn(), persist: vi.fn(), isRoomActive: vi.fn() }))
vi.mock('../plugnmeet/client', () => ({ plugNmeet: { isRoomActive: mocks.isRoomActive } }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor', first_name: 'Ada' }); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { const u = c.get('user'); c.set('account', { id: u.school_id, membershipId: 'membership-1', role: u.role === 'student' ? 'learner' : u.role }); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../plugnmeet/classroom-lifecycle', () => ({ ensurePlugNmeetReady: mocks.ensureReady, isPlugNmeetHealthy: vi.fn() }))

vi.mock('../plugnmeet/provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../plugnmeet/provider')>()),
  createPlugNmeetRoom: mocks.createRoom,
  persistProvider: mocks.persist,
  getPlugNmeetClientConfig: vi.fn().mockResolvedValue({ join_token: 't' }),
}))

vi.mock('../recording/recorder-fleet', () => ({ reconcileRecorderFleet: vi.fn().mockResolvedValue({}), recorderFleetReadiness: vi.fn(), recordingAdmission: mocks.admission }))

import { liveClassesRouter } from './live-classes'

function chain(result: any) {
  const value: any = { select: () => value, insert: () => value, update: () => value, delete: () => value, eq: () => value, in: () => value, limit: () => value, maybeSingle: async () => result, single: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) }
  return value
}

describe('POST /live-classes/start-now', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.admission.mockResolvedValue({ admitted: true }); mocks.ensureReady.mockResolvedValue({ state: 'preparing' }) })

  it('keeps the new class while the PlugNmeet classroom wakes', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: { id: 'membership-1' }, error: null })
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      if (table === 'live_classes') return chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
      throw new Error(`Unexpected table: ${table}`)
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ data: { id: 'class-1', state: 'preparing', class_title: 'Mathematics class' } })
  })

  it('refuses a host without an active Tutor membership (DEV-LVC-001)', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: null, error: null })
      throw new Error(`Unexpected table: ${table}`)
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ access_mode: 'anyone_with_link' }) })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_TUTOR' })
  })

  it('never deletes the class row once the provider room exists (DEV-LVC-003)', async () => {
    mocks.ensureReady.mockResolvedValue({ state: 'ready' })
    mocks.createRoom.mockResolvedValue({ providerRoomId: 'class-1-g1' })
    mocks.persist.mockRejectedValue(new Error('database down'))
    const calls: string[] = []
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: { id: 'membership-1' }, error: null })
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      if (table === 'live_classes') {
        const value = chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
        value.delete = () => { calls.push('delete'); return value }
        value.update = (payload: any) => { calls.push(`update:${payload.status}`); return value }
        return value
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'CLASS_START_FAILED', data: { id: 'class-1' } })
    expect(calls).toEqual(['update:starting', 'update:starting'])
  })

  it('still removes the placeholder row when the provider room was never created', async () => {
    mocks.ensureReady.mockResolvedValue({ state: 'ready' })
    mocks.createRoom.mockRejectedValue(new Error('provider down'))
    mocks.isRoomActive.mockResolvedValue(false)
    const calls: string[] = []
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: { id: 'membership-1' }, error: null })
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      const value = chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
      value.delete = () => { calls.push('delete'); return value }
      return value
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(response.status).toBe(500)
    expect(calls).toEqual(['delete'])
  })

  it('keeps the row when the provider call failed but the room cannot be confirmed absent (DEV-LVC-003)', async () => {
    mocks.ensureReady.mockResolvedValue({ state: 'ready' })
    mocks.createRoom.mockRejectedValue(new Error('timeout'))
    mocks.isRoomActive.mockRejectedValue(new Error('provider unreachable'))
    const calls: string[] = []
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: { id: 'membership-1' }, error: null })
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      const value = chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
      value.delete = () => { calls.push('delete'); return value }
      value.update = (payload: any) => { calls.push(`update:${payload.status}:${payload.provider_room_id}`); return value }
      return value
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(response.status).toBe(500)
    expect(calls).toEqual(['update:starting:class-1-g1', 'update:starting:class-1-g1'])
  })

  it('treats an already existing deterministic room as success on retry (DEV-LVC-003)', async () => {
    mocks.ensureReady.mockResolvedValue({ state: 'ready' })
    mocks.createRoom.mockRejectedValue(new Error('room already exists'))
    mocks.isRoomActive.mockResolvedValue(true)
    mocks.persist.mockRejectedValue(new Error('database down'))
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: { id: 'membership-1' }, error: null })
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      return chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
    })
    await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(mocks.persist).toHaveBeenCalled()
  })

  it('starts the class without recording and returns a clear flag when recorder capacity is exceeded (DEV-REC-002)', async () => {
    mocks.ensureReady.mockResolvedValue({ state: 'ready' })
    mocks.createRoom.mockResolvedValue({ providerRoomId: 'class-1-g1' })
    mocks.persist.mockResolvedValue(undefined)
    mocks.admission.mockResolvedValue({ admitted: false, code: 'RECORDING_CAPACITY_EXCEEDED', message: 'full' })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') return chain({ data: { id: 'membership-1' }, error: null })
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      return chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
    })
    const response = await liveClassesRouter.request('/start-now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: 'course-1' }) })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ data: { status: 'live', recording_available: false, recording_code: 'RECORDING_CAPACITY_EXCEEDED' } })
    expect(mocks.createRoom).toHaveBeenCalledWith(expect.objectContaining({ recordingAllowed: false }))
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), createRoom: vi.fn(), isRoomActive: vi.fn(), liveClass: {} as any }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', { id: 'school-1', membershipId: 'm-1', role: 'tutor' }); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../lib/classroom-access', () => ({
  classroomAccessError: () => ({ error: 'x', code: 'X', status: 403 }),
  resolveClassroomAccess: async () => ({ liveClass: mocks.liveClass, isHost: true }),
}))
vi.mock('../plugnmeet/classroom-lifecycle', () => ({ ensurePlugNmeetReady: vi.fn().mockResolvedValue({ state: 'ready' }), isPlugNmeetHealthy: vi.fn() }))
vi.mock('../plugnmeet/client', () => ({ plugNmeet: { isRoomActive: mocks.isRoomActive } }))
vi.mock('../recording/recorder-fleet', () => ({ reconcileRecorderFleet: vi.fn().mockResolvedValue({}), recorderFleetReadiness: vi.fn(), recordingAdmission: vi.fn().mockResolvedValue({ admitted: true }) }))
vi.mock('../plugnmeet/provider', () => ({
  providerForClass: () => 'plugnmeet',
  createPlugNmeetRoom: mocks.createRoom,
  persistProvider: vi.fn(),
  getPlugNmeetClientConfig: vi.fn().mockResolvedValue({ join_token: 't' }),
}))

import { liveClassesRouter } from './live-classes'

describe('POST /live-classes/:id/start claim (DEV-LVC-003)', () => {
  const updates: any[] = []
  const filters: Array<[string, unknown]> = []
  let claimResult: any
  beforeEach(() => {
    vi.clearAllMocks(); updates.length = 0; filters.length = 0
    claimResult = { data: { id: 'class-1' }, error: null }
    mocks.createRoom.mockResolvedValue({ providerRoomId: 'class-1-g1' })
    mocks.from.mockImplementation(() => {
      const value: any = {
        update: (payload: any) => { updates.push(payload); return value },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return value },
        select: () => value,
        maybeSingle: async () => claimResult,
        single: async () => ({ data: { id: 'class-1', title: 'T', status: 'ready' }, error: null }),
      }
      return value
    })
  })

  it('persists the deterministic room name in the claim before calling the provider', async () => {
    mocks.liveClass = { id: 'class-1', title: 'T', status: 'scheduled', provider_generation: 2, access_mode: 'enrolled_learners' }
    const response = await liveClassesRouter.request('/class-1/start', { method: 'POST' })
    expect(response.status).toBe(200)
    expect(updates[0]).toMatchObject({ status: 'starting', provider_room_id: 'class-1-g2', classroom_provider: 'plugnmeet' })
    expect(filters).toContainEqual(['status', 'scheduled'])
    expect(mocks.createRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'class-1-g2' }))
  })

  it('does not call the provider when another request already holds the claim', async () => {
    mocks.liveClass = { id: 'class-1', title: 'T', status: 'scheduled', access_mode: 'enrolled_learners' }
    claimResult = { data: null, error: null }
    const response = await liveClassesRouter.request('/class-1/start', { method: 'POST' })
    expect(response.status).toBe(202)
    expect(mocks.createRoom).not.toHaveBeenCalled()
  })

  it('reports preparing for a fresh starting claim without calling the provider', async () => {
    mocks.liveClass = { id: 'class-1', title: 'T', status: 'starting', provider_room_id: 'class-1-g1', start_requested_at: new Date().toISOString(), access_mode: 'enrolled_learners' }
    const response = await liveClassesRouter.request('/class-1/start', { method: 'POST' })
    expect(response.status).toBe(202)
    expect(mocks.createRoom).not.toHaveBeenCalled()
  })

  it('lets the host resume a stale starting claim with the same room name and a timestamp compare-and-set', async () => {
    const stale = new Date(Date.now() - 5 * 60_000).toISOString()
    mocks.liveClass = { id: 'class-1', title: 'T', status: 'starting', provider_room_id: 'class-1-g1', start_requested_at: stale, access_mode: 'enrolled_learners' }
    const response = await liveClassesRouter.request('/class-1/start', { method: 'POST' })
    expect(response.status).toBe(200)
    expect(filters).toContainEqual(['status', 'starting'])
    expect(filters).toContainEqual(['start_requested_at', stale])
    expect(mocks.createRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'class-1-g1' }))
  })
})

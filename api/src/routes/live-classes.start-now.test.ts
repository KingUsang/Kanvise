import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: {
    id: 'tutor-1',
    school_id: 'school-1',
    role: 'tutor',
    first_name: 'Ada',
    last_name: 'Okafor',
    kanvise_user_id: 'KNV-TUT-1',
  } as any,
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  deletedClassIds: [] as string[],
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

vi.mock('livekit-server-sdk', () => ({
  AccessToken: class {
    addGrant() {}
    async toJwt() { return 'livekit-token' }
  },
  RoomServiceClient: class {
    createRoom = mocks.createRoom
    deleteRoom = mocks.deleteRoom
  },
  TrackSource: { CAMERA: 'camera', MICROPHONE: 'microphone' },
  WebhookReceiver: class {},
}))

import { liveClassesRouter } from './live-classes'

function chain(result: any) {
  const value: any = {
    select: () => value,
    insert: () => value,
    update: () => value,
    delete: () => value,
    eq: (_column: string, compared: string) => {
      if (_column === 'id' && value.isDelete) mocks.deletedClassIds.push(compared)
      return value
    },
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (settled: any) => void) => Promise.resolve(result).then(resolve),
    isDelete: false,
  }
  value.delete = () => {
    value.isDelete = true
    return value
  }
  return value
}

describe('POST /live-classes/start-now', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deletedClassIds.length = 0
    vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com')
    vi.stubEnv('LIVEKIT_API_KEY', 'test-key')
    vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret')
    mocks.createRoom.mockResolvedValue({ name: 'kanvise-class-class-1' })
    mocks.deleteRoom.mockResolvedValue(undefined)
  })

  function configureDatabase(updateResult: any) {
    let liveClassCall = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tutor_course_assignments') return chain({ data: { course_id: 'course-1' }, error: null })
      if (table === 'courses') return chain({ data: { id: 'course-1', name: 'Mathematics' }, error: null })
      if (table === 'avatar_configs') return chain({ data: null, error: null })
      if (table === 'live_classes') {
        liveClassCall += 1
        if (liveClassCall === 1) return chain({ data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60 }, error: null })
        if (liveClassCall === 2) return chain(updateResult)
        return chain({ data: null, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  }

  it('creates and starts a class with defaults in one request', async () => {
    configureDatabase({
      data: { id: 'class-1', title: 'Mathematics class', course_id: 'course-1', tutor_id: 'tutor-1', duration_minutes: 60, status: 'live', livekit_room_name: 'kanvise-class-class-1' },
      error: null,
    })

    const response = await liveClassesRouter.request('/start-now', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ course_id: 'course-1' }),
    })
    const body = await response.json() as any

    expect(response.status).toBe(201)
    expect(mocks.createRoom).toHaveBeenCalledWith({ name: 'kanvise-class-class-1', emptyTimeout: 300, maxParticipants: 200 })
    expect(body.data).toMatchObject({ id: 'class-1', class_title: 'Mathematics class', course_name: 'Mathematics', is_host: true })
    expect(mocks.deletedClassIds).toEqual([])
  })

  it('removes the room and inserted class when activation fails', async () => {
    configureDatabase({ data: null, error: { message: 'database unavailable' } })

    const response = await liveClassesRouter.request('/start-now', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ course_id: 'course-1' }),
    })

    expect(response.status).toBe(500)
    expect(mocks.deleteRoom).toHaveBeenCalledWith('kanvise-class-class-1')
    expect(mocks.deletedClassIds).toContain('class-1')
    expect((await response.json() as any).error).toMatch(/Nothing was scheduled/)
  })
})

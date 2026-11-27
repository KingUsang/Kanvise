import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  exists: vi.fn(),
  sign: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }))
vi.mock('../storage/r2', () => ({ createPresignedDownload: mocks.sign, privateObjectExists: mocks.exists }))
vi.mock('../plugnmeet/provider', () => ({ getPlugNmeetClientConfig: vi.fn(), providerForClass: () => 'plugnmeet' }))

import { publicLiveClassesRouter } from './public-live-classes'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const shareToken = 'sharetoken123'
const classId = '11111111-1111-4111-8111-111111111111'
const liveClass = {
  id: classId, school_id: 'school-1', course_id: 'course-1', title: 'Maths', status: 'scheduled', scheduled_at: '2030-01-01T10:00:00Z',
  tutor_id: 'tutor-1', teaching_mode: 'whiteboard', access_mode: 'anyone_with_link', share_token_hash: hash(shareToken), share_link_revoked_at: null,
  school: { name: 'Centre', logo_url: null },
}

function builder(result: any) {
  const value: any = {
    select: () => value, eq: () => value, is: () => value, gt: () => value, order: () => value, range: () => value, limit: () => value, update: () => value,
    maybeSingle: async () => result, single: async () => result,
    then: (resolve: (v: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('GET /public/live-classes/by-id/:classId (DEV-LVC-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockImplementation((table: string) => builder(table === 'live_classes' ? { data: liveClass, error: null } : { data: null, error: null }))
  })

  it('rejects a bare Session UUID without a share token or authorization', async () => {
    const response = await publicLiveClassesRouter.request(`/by-id/${classId}`)
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'LINK_UNAVAILABLE' })
  })

  it('rejects a wrong share token', async () => {
    expect((await publicLiveClassesRouter.request(`/by-id/${classId}?share_token=wrongtoken12`)).status).toBe(404)
  })

  it('rejects a revoked share token', async () => {
    mocks.from.mockReturnValue(builder({ data: { ...liveClass, share_link_revoked_at: '2030-01-01T00:00:00Z' }, error: null }))
    expect((await publicLiveClassesRouter.request(`/by-id/${classId}?share_token=${shareToken}`)).status).toBe(404)
  })

  it('does not accept a share token for an enrolled-only class', async () => {
    mocks.from.mockReturnValue(builder({ data: { ...liveClass, access_mode: 'enrolled_learners' }, error: null }))
    expect((await publicLiveClassesRouter.request(`/by-id/${classId}?share_token=${shareToken}`)).status).toBe(404)
  })

  it('returns the projection for the active share token', async () => {
    const response = await publicLiveClassesRouter.request(`/by-id/${classId}?share_token=${shareToken}`)
    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.data).toMatchObject({ title: 'Maths', access_mode: 'anyone_with_link', can_host: false })
    expect(JSON.stringify(body)).not.toContain('tutor-1')
  })

  it('returns the projection for an authenticated enrolled member', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    mocks.from.mockImplementation((table: string) => builder(table === 'live_classes'
      ? { data: liveClass, error: null }
      : { data: { id: 'student-1', role: 'student', school_id: 'school-1' }, error: null }))
    const response = await publicLiveClassesRouter.request(`/by-id/${classId}`, { headers: { Authorization: 'Bearer jwt' } })
    expect(response.status).toBe(200)
  })

  it('answers 503 when the member lookup fails rather than reporting a missing membership (DEV-LVC-029)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    mocks.from.mockImplementation((table: string) => builder(table === 'live_classes'
      ? { data: liveClass, error: null }
      : { data: null, error: { message: 'connection reset' } }))
    const response = await publicLiveClassesRouter.request(`/by-id/${classId}`, { headers: { Authorization: 'Bearer jwt' } })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'MEMBER_LOOKUP_UNAVAILABLE' })
  })

  it('answers 503 on an Auth provider outage but treats an invalid token as not a member', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: 'auth down' } })
    expect((await publicLiveClassesRouter.request(`/by-id/${classId}`, { headers: { Authorization: 'Bearer jwt' } })).status).toBe(503)
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: 'invalid jwt' } })
    expect((await publicLiveClassesRouter.request(`/by-id/${classId}`, { headers: { Authorization: 'Bearer jwt' } })).status).toBe(404)
  })
})

describe('public presentations projection (DEV-LVC-011, DEV-LVC-029)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('omits the internal Tutor profile id', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'live_classes') return builder({ data: { ...liveClass, status: 'live' }, error: null })
      if (table === 'live_class_guests') return builder({ data: { id: 'guest-1', display_name: 'Guest' }, error: null })
      return builder({ data: [], error: null })
    })
    const response = await publicLiveClassesRouter.request(`/${shareToken}/presentations`, { headers: { Cookie: `kanvise_live_guest=${'a'.repeat(43)}` } })
    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.data).not.toHaveProperty('tutor_identity')
    expect(JSON.stringify(body)).not.toContain('tutor-1')
  })

  it('answers 503 when the member lookup fails instead of asking the visitor to join again', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'live_classes') return builder({ data: { ...liveClass, status: 'live' }, error: null })
      if (table === 'user_profiles') return builder({ data: null, error: { message: 'timeout' } })
      return builder({ data: null, error: null })
    })
    const response = await publicLiveClassesRouter.request(`/${shareToken}/presentations`, { headers: { Authorization: 'Bearer jwt' } })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'MEMBER_LOOKUP_UNAVAILABLE' })
  })
})

describe('GET /public/live-classes/recordings/:token (DEV-LVC-019)', () => {
  const token = 'r'.repeat(43)
  const link = { live_class_id: classId, school_id: 'school-1' }
  const setup = (recordings: any, opts: { linkError?: any; recError?: any } = {}) => mocks.from.mockImplementation((table: string) => {
    if (table === 'live_class_recording_share_links') return builder({ data: opts.linkError ? null : link, error: opts.linkError || null })
    if (table === 'live_class_recordings') return builder({ data: recordings, error: opts.recError || null })
    return builder({ data: { id: classId, title: 'Maths', scheduled_at: '2030-01-01T10:00:00Z', tutor: null, course: null }, error: null })
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.exists.mockResolvedValue(true)
    mocks.sign.mockResolvedValue('https://signed.example/r.mp4')
  })

  it.each([
    [[], 404, 'RECORDING_NOT_READY', 'none'],
    [[{ id: 'r', status: 'pending' }], 409, 'RECORDING_PROCESSING', 'processing'],
    [[{ id: 'r', status: 'uploaded' }], 409, 'RECORDING_PROCESSING', 'processing'],
    [[{ id: 'r', status: 'failed' }], 409, 'RECORDING_FAILED', 'failed'],
  ])('returns a lifecycle outcome without signing a URL for %j', async (rows, status, code, recordingStatus) => {
    setup(rows)
    const response = await publicLiveClassesRouter.request(`/recordings/${token}`)
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ code, recording_status: recordingStatus })
    expect(mocks.sign).not.toHaveBeenCalled()
  })

  it('returns the lifecycle status and a signed URL for a ready recording', async () => {
    setup([{ id: 'r', status: 'ready', r2_file_key: 'k.mp4' }])
    const response = await publicLiveClassesRouter.request(`/recordings/${token}`)
    expect(response.status).toBe(200)
    expect((await response.json() as any).data).toMatchObject({ recording_status: 'ready', playback_url: 'https://signed.example/r.mp4' })
  })

  it('answers 503 when a dependency fails instead of reporting an unavailable link', async () => {
    setup([], { linkError: { message: 'db down' } })
    expect((await publicLiveClassesRouter.request(`/recordings/${token}`)).status).toBe(503)
    setup(null, { recError: { message: 'db down' } })
    const response = await publicLiveClassesRouter.request(`/recordings/${token}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'RECORDING_LOOKUP_UNAVAILABLE' })
  })

  it('returns 404 for a revoked or unknown link', async () => {
    mocks.from.mockReturnValue(builder({ data: null, error: null }))
    expect((await publicLiveClassesRouter.request(`/recordings/${token}`)).status).toBe(404)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createUpload: vi.fn(),
  loadCourseIds: vi.fn(),
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../lib/student-course-access', () => ({ loadStudentCourseIds: mocks.loadCourseIds }))
vi.mock('../storage/r2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, createPresignedUpload: mocks.createUpload }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', { id: mocks.user.school_id, membershipId: 'm-1', role: mocks.user.role === 'student' ? 'learner' : mocks.user.role })
    await next()
  },
}))

import { storageRouter } from './storage'

const COURSE = '11111111-1111-4111-8111-111111111111'
const ASSIGNMENT = '22222222-2222-4222-8222-222222222222'

function query(result: any) {
  const value: any = {
    select: () => value, eq: () => value,
    maybeSingle: async () => result, single: async () => result,
  }
  return value
}

function queue(...results: any[]) {
  const pending = [...results]
  mocks.from.mockImplementation(() => query(pending.shift() ?? { data: null, error: null }))
}

function post(body: unknown) {
  return storageRouter.request('/presign/upload', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

const noteBody = { file_name: 'Notes.pdf', content_type: 'application/pdf', file_size_bytes: 1000, entity_type: 'note', course_id: COURSE }

describe('generic private upload presign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.createUpload.mockResolvedValue({ presignedUrl: 'https://r2.example/u', fileKey: 'key', expiresInSeconds: 900 })
    mocks.loadCourseIds.mockResolvedValue([])
  })

  it.each(['live_class_presentation', 'live_class_recording', 'live_class_transcript', 'feedback_screenshot'])(
    'rejects internal type %s without signing', async (entity_type) => {
      const response = await post({ ...noteBody, entity_type })
      expect(response.status).toBe(403)
      expect(mocks.createUpload).not.toHaveBeenCalled()
      expect(mocks.from).not.toHaveBeenCalled()
    })

  it('rejects unknown entity types and malformed bodies', async () => {
    expect((await post({ ...noteBody, entity_type: 'nope' })).status).toBe(400)
    expect((await post({ ...noteBody, course_id: 'not-a-uuid' })).status).toBe(400)
    expect((await post({ ...noteBody, file_size_bytes: -1 })).status).toBe(400)
    expect(mocks.createUpload).not.toHaveBeenCalled()
  })

  it('returns 403 for a course the tutor is not assigned to', async () => {
    queue({ data: { id: COURSE, programme_id: 'p' }, error: null }, { data: null, error: null })
    const response = await post(noteBody)
    expect(response.status).toBe(403)
    expect(mocks.createUpload).not.toHaveBeenCalled()
  })

  it('returns 503, not 403, when the course lookup fails', async () => {
    queue({ data: null, error: { message: 'db down' } })
    const response = await post(noteBody)
    expect(response.status).toBe(503)
    expect((await response.json() as any).code).toBe('SERVICE_UNAVAILABLE')
  })

  it('returns 503 when the assignment lookup fails for a learner submission', async () => {
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
    queue({ data: null, error: { message: 'db down' } })
    const response = await post({ file_name: 'a.pdf', content_type: 'application/pdf', file_size_bytes: 10, entity_type: 'submission', assignment_id: ASSIGNMENT })
    expect(response.status).toBe(503)
  })

  it('signs for an assigned tutor', async () => {
    queue({ data: { id: COURSE, programme_id: 'p' }, error: null }, { data: { id: 'tca-1' }, error: null })
    const response = await post(noteBody)
    expect(response.status).toBe(200)
    expect(mocks.createUpload).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'note', contextId: COURSE }))
  })
})

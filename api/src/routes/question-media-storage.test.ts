import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createUpload: vi.fn(),
  createDownload: vi.fn(),
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor', kanvise_user_id: 'KNV-TUT-1', supabase_auth_id: 'auth-1' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, createPresignedUpload: mocks.createUpload, createPresignedDownload: mocks.createDownload }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { storageRouter } from './storage'

function query(result: any) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  }
  return builder
}

const bankId = '11111111-1111-4111-8111-111111111111'
const fileKey = `schools/school-1/private/question_media/${bankId}/image.png`

describe('question media storage authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.id = 'tutor-1'
    mocks.user.role = 'tutor'
    mocks.user.school_id = 'school-1'
  })

  it('allows a tutor to upload into a centre bank in their school', async () => {
    mocks.from.mockReturnValue(query({ data: { owner_id: 'other-tutor', visibility: 'centre', archived_at: null }, error: null }))
    mocks.createUpload.mockResolvedValue({ presignedUrl: 'https://upload.example', fileKey, expiresInSeconds: 900 })
    const response = await storageRouter.request('/presign/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question_media', bank_id: bankId, file_name: 'image.png',
        content_type: 'image/png', file_size_bytes: 100,
      }),
    })
    expect(response.status).toBe(200)
    expect(mocks.createUpload).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: 'school-1', entityType: 'question_media', contextId: bankId,
    }))
  })

  it('rejects a tutor uploading into another tutor private bank', async () => {
    mocks.from.mockReturnValue(query({ data: { owner_id: 'other-tutor', visibility: 'private', archived_at: null }, error: null }))
    const response = await storageRouter.request('/presign/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'question_media', bank_id: bankId, file_name: 'image.png',
        content_type: 'image/png', file_size_bytes: 100,
      }),
    })
    expect(response.status).toBe(403)
    expect(mocks.createUpload).not.toHaveBeenCalled()
  })

  it('never signs a generic question-media download for a student', async () => {
    mocks.user.role = 'student'
    const response = await storageRouter.request(`/presign/download?file_key=${encodeURIComponent(fileKey)}`)
    expect(response.status).toBe(403)
    expect(mocks.createDownload).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createPublic: vi.fn(),
  verifyPublic: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1', supabase_auth_id: 'auth-1' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return {
    ...actual,
    createPresignedPublicUpload: mocks.createPublic,
    verifyPublicUpload: mocks.verifyPublic,
    deleteStoredObject: vi.fn(),
  }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { storageRouter } from './storage'

function query(result: any) {
  const builder: any = {
    select: () => builder,
    update: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
    single: async () => result,
  }
  return builder
}

describe('public media storage routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.role = 'admin'
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com'
  })

  it('rejects a student attempting to upload school branding', async () => {
    mocks.user.role = 'student'
    const response = await storageRouter.request('/presign/public', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity_type: 'logo', context_id: 'school-1', file_name: 'logo.png', content_type: 'image/png', file_size_bytes: 100 }),
    })
    expect(response.status).toBe(403)
    expect(mocks.createPublic).not.toHaveBeenCalled()
  })

  it('issues a school- and context-scoped public upload intent', async () => {
    mocks.createPublic.mockResolvedValue({
      presignedUrl: 'https://upload.example.com',
      fileKey: 'schools/school-1/public/logo/school-1/file.png',
      publicUrl: 'https://cdn.example.com/schools/school-1/public/logo/school-1/file.png',
      expiresInSeconds: 900,
    })
    const response = await storageRouter.request('/presign/public', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity_type: 'logo', context_id: 'school-1', file_name: 'logo.png', content_type: 'image/png', file_size_bytes: 100 }),
    })
    expect(response.status).toBe(200)
    expect(mocks.createPublic).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1', entityType: 'logo', contextId: 'school-1' }))
  })

  it('verifies an upload before saving the permanent school URL', async () => {
    mocks.verifyPublic.mockResolvedValue(true)
    mocks.from.mockReturnValueOnce(query({ data: { logo_url: null }, error: null }))
      .mockReturnValueOnce(query({ data: { id: 'school-1', logo_url: 'saved' }, error: null }))
    const fileKey = 'schools/school-1/public/logo/school-1/file.png'
    const response = await storageRouter.request('/public/confirm', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity_type: 'logo', context_id: 'school-1', file_key: fileKey, content_type: 'image/png', file_size_bytes: 100 }),
    })
    expect(response.status).toBe(200)
    expect(mocks.verifyPublic).toHaveBeenCalledWith(expect.objectContaining({ fileKey, schoolId: 'school-1' }))
    expect(mocks.from).toHaveBeenCalledWith('schools')
  })
})

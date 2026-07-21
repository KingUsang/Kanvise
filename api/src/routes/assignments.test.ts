import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), verify: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, verifyPrivateUpload: mocks.verify, createPresignedDownload: vi.fn() }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', school_id: 'school-1', role: 'admin', kanvise_user_id: 'KNV-ADM-1', supabase_auth_id: 'auth-1' })
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { courseAssignmentsRouter } from './assignments'

function builder(result: any) {
  const value: any = {
    select: () => value, insert: () => value, eq: () => value,
    maybeSingle: async () => result, single: async () => result,
  }
  return value
}

describe('assignment attachment registration', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects deadlines less than one hour away before touching R2', async () => {
    mocks.from.mockReturnValue(builder({ data: { id: 'course-1' }, error: null }))
    const response = await courseAssignmentsRouter.request('/course-1/assignments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Essay', description: 'Write it', deadline_at: new Date(Date.now() + 30_000).toISOString() }),
    })
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('DEADLINE_TOO_SOON')
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('verifies an attachment object before inserting the assignment', async () => {
    const inserted = { id: 'assignment-1', title: 'Essay' }
    let assignmentCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'courses') return builder({ data: { id: 'course-1' }, error: null })
      assignmentCalls += 1
      return assignmentCalls === 1
        ? builder({ data: null, error: null })
        : builder({ data: inserted, error: null })
    })
    mocks.verify.mockResolvedValue(true)
    const response = await courseAssignmentsRouter.request('/course-1/assignments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Essay', description: 'Write it', deadline_at: new Date(Date.now() + 7_200_000).toISOString(),
        attachment_file_key: 'schools/school-1/private/assignment_attachment/course-1/file.pdf',
        attachment_file_name: 'file.pdf', attachment_file_type: 'application/pdf', attachment_file_size_bytes: 100,
      }),
    })
    expect(response.status).toBe(201)
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1', entityType: 'assignment_attachment', contextId: 'course-1' }))
    expect(mocks.from).toHaveBeenCalledWith('assignments')
  })
})

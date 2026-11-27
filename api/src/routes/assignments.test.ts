import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../storage/upload-intents', () => ({
  recordUploadIntent: vi.fn(async () => undefined),
  consumeUploadIntent: vi.fn(async () => 'consumed'),
  releaseUploadIntent: vi.fn(async () => undefined),
}))

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), verify: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
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
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', { id: 'school-1', membershipId: 'membership-1', role: 'admin' })
    await next()
  },
  requireMembershipRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { assignmentsRouter, courseAssignmentsRouter } from './assignments'

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

  it('rejects unknown and oversized create fields with VALIDATION_ERROR', async () => {
    mocks.from.mockReturnValue(builder({ data: { id: 'course-1' }, error: null }))
    const base = { title: 'Essay', description: 'Write it', deadline_at: new Date(Date.now() + 7_200_000).toISOString() }
    for (const body of [{ ...base, tutor_id: 'x' }, { ...base, title: 'x'.repeat(201) }, { ...base, deadline_at: 'tomorrow' }, { ...base, description: '   ' }]) {
      const response = await courseAssignmentsRouter.request('/course-1/assignments', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      expect(response.status).toBe(400)
      expect((await response.json() as any).code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('assignment update and delete guards', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const future = () => new Date(Date.now() + 7_200_000).toISOString()
  const patch = (body: unknown) => assignmentsRouter.request(`/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'assignments') return builder({ data: { id, course_id: 'course-1', attachment_file_key: null }, error: null })
      if (table === 'courses') return builder({ data: { id: 'course-1' }, error: null })
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it.each([
    [{}], [{ title: '   ' }], [{ title: 'ok', attachment_file_key: 'schools/x/file.pdf' }], [{ is_published: true }],
    [{ deadline_at: 'soon' }], [{ description: 'x'.repeat(10_001) }],
  ])('rejects update body %j so it cannot bypass create rules', async (body) => {
    const response = await patch(body)
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('VALIDATION_ERROR')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('normalizes fields and applies the update through the guarded function', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ok', assignment: { id, title: 'New' } }, error: null })
    const deadline = new Date(Date.now() + 7_200_000)
    const response = await patch({ title: '  New  ', deadline_at: deadline.toISOString() })
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('update_assignment_guarded', {
      p_school_id: 'school-1', p_assignment_id: id, p_title: 'New', p_description: null, p_deadline_at: deadline.toISOString(),
    })
  })

  it('maps a deadline shortening conflict to 409', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'has_submissions' }, error: null })
    const response = await patch({ deadline_at: future() })
    expect(response.status).toBe(409)
    expect((await response.json() as any).code).toBe('CANNOT_SHORTEN_DEADLINE_WITH_SUBMISSIONS')
  })

  it('fails closed with 503 when the guarded update errors', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'detail' } })
    const response = await patch({ title: 'New' })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Could not load assignment data right now', code: 'ASSIGNMENT_UPDATE_FAILED' })
  })

  it('maps a delete with submissions to 409 and a function error to 503', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'has_submissions' }, error: null })
    const conflict = await assignmentsRouter.request(`/${id}`, { method: 'DELETE' })
    expect(conflict.status).toBe(409)
    expect((await conflict.json() as any).code).toBe('HAS_SUBMISSIONS')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
    const failed = await assignmentsRouter.request(`/${id}`, { method: 'DELETE' })
    expect(failed.status).toBe(503)
    expect((await failed.json() as any).code).toBe('ASSIGNMENT_DELETE_FAILED')
  })
})

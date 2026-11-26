import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), verifyPrivateUpload: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn(), verifyPrivateUpload: mocks.verifyPrivateUpload }))
vi.mock('../domain/question-bank', () => ({
  BANK_VISIBILITIES: ['private', 'centre'],
  canEditQuestionBank: vi.fn(() => true),
  canReadQuestionBank: vi.fn(() => true),
  escapeLikePattern: (value: string) => value,
  validateQuestionInput: vi.fn(() => []),
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor' })
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { questionBanksRouter } from './question-banks'

function query(result: any, calls: Array<[string, ...any[]]>) {
  const builder: any = {
    select: (...args: any[]) => { calls.push(['select', ...args]); return builder },
    eq: (...args: any[]) => { calls.push(['eq', ...args]); return builder },
    is: (...args: any[]) => { calls.push(['is', ...args]); return builder },
    or: (...args: any[]) => { calls.push(['or', ...args]); return builder },
    order: (...args: any[]) => { calls.push(['order', ...args]); return builder },
    range: (...args: any[]) => { calls.push(['range', ...args]); return builder },
    ilike: (...args: any[]) => { calls.push(['ilike', ...args]); return builder },
    in: (...args: any[]) => { calls.push(['in', ...args]); return builder },
    insert: (...args: any[]) => { calls.push(['insert', ...args]); return builder },
    update: (...args: any[]) => { calls.push(['update', ...args]); return builder },
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('question bank pagination boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unsafe page offset before querying', async () => {
    const response = await questionBanksRouter.request('/?page=9007199254740991&page_size=2')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('retains the existing range for safe page inputs', async () => {
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockReturnValue(query({
      data: [{ id: 'bank-1', questions: [{ count: 2 }] }], error: null, count: 1,
    }, calls))

    const response = await questionBanksRouter.request('/?page=2&page_size=10')
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['range', 10, 19])
    expect((await response.json() as any).pagination).toEqual({ page: 2, page_size: 10, total: 1, has_more: false })
  })

  it('rejects malformed bank paths before querying', async () => {
    const response = await questionBanksRouter.request('/not-a-uuid')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    ['GET', '/not-a-uuid/questions'],
    ['POST', '/not-a-uuid/questions'],
    ['PATCH', '/questions/not-a-uuid'],
    ['GET', '/questions/not-a-uuid/versions'],
    ['GET', '/media/not-a-uuid/url?bank_id=11111111-1111-4111-8111-111111111111'],
    ['GET', '/media/11111111-1111-4111-8111-111111111111/url?bank_id=not-a-uuid'],
  ])('rejects malformed Question Bank UUID boundary %s %s before querying', async (method, path) => {
    const response = await questionBanksRouter.request(path, { method })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects malformed media identifiers before database or storage access', async () => {
    const response = await questionBanksRouter.request('/media/confirm', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bank_id: 'not-a-uuid', file_key: 'key', file_name: 'image.png',
        content_type: 'image/png', file_size_bytes: 100, alt_text: 'A diagram',
      }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.verifyPrivateUpload).not.toHaveBeenCalled()
  })

  it('maps bank list fields without tenant or ownership columns', async () => {
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockReturnValue(query({
      data: [{
        id: 'bank-1', created_at: '2026-01-01', updated_at: '2026-01-02', archived_at: null,
        school_id: 'school-secret', owner_id: 'owner-secret', name: 'Physics', description: null,
        visibility: 'private', questions: [{ count: 3 }],
      }], error: null, count: 1,
    }, calls))

    const response = await questionBanksRouter.request('/')
    expect(response.status).toBe(200)
    const bank = (await response.json() as any).data[0]
    expect(bank).toMatchObject({ id: 'bank-1', name: 'Physics', question_count: 3, can_edit: true })
    expect(bank).not.toHaveProperty('school_id')
    expect(bank).not.toHaveProperty('owner_id')
  })

  it('maps question list fields without tenant, bank, author, or creator columns', async () => {
    const bankId = '11111111-1111-4111-8111-111111111111'
    const questionId = '22222222-2222-4222-8222-222222222222'
    const versionId = '33333333-3333-4333-8333-333333333333'
    const calls: Array<[string, ...any[]]> = []
    mocks.from.mockImplementation((table: string) => table === 'question_banks'
      ? query({ data: { id: bankId, owner_id: 'owner-1', school_id: 'school-1', visibility: 'private' }, error: null }, calls)
      : query({ data: [{
          id: questionId, created_at: '2026-01-01', updated_at: '2026-01-02', archived_at: null,
          school_id: 'school-secret', bank_id: bankId, author_id: 'author-secret', course_id: 'course-1',
          subject_name: 'Physics', topic: 'Motion', subtopic: null, question_type: 'mcq', status: 'active',
          current_version: {
            id: versionId, version_number: 1, created_at: '2026-01-01', created_by: 'creator-secret',
            stimulus_id: null, plain_text: 'What moves?', content_blocks: [], explanation_blocks: [],
            grading_rubric_blocks: [], marks: 2, options: [{ id: 'option-1', plain_text: 'A', content_blocks: [], is_correct: true, order_index: 0 }],
          },
        }], error: null, count: 1 }, calls))

    const response = await questionBanksRouter.request(`/${bankId}/questions`)
    expect(response.status).toBe(200)
    const question = (await response.json() as any).data[0]
    expect(question).toMatchObject({ id: questionId, course_id: 'course-1', current_version: { id: versionId } })
    expect(question).not.toHaveProperty('school_id')
    expect(question).not.toHaveProperty('bank_id')
    expect(question).not.toHaveProperty('author_id')
    expect(question.current_version).not.toHaveProperty('created_by')
  })

  it('maps created banks and questions with the same feature contracts', async () => {
    const bankId = '44444444-4444-4444-8444-444444444444'
    const questionId = '55555555-5555-4555-8555-555555555555'
    const versionId = '66666666-6666-4666-8666-666666666666'
    mocks.from.mockImplementation((table: string) => table === 'question_banks'
      ? query({ data: { id: bankId, created_at: '2026-01-01', updated_at: '2026-01-01', archived_at: null, school_id: 'school-1', owner_id: 'owner-1', name: 'Chemistry', description: null, visibility: 'private' }, error: null }, [])
      : query({ data: {
          id: questionId, created_at: '2026-01-01', updated_at: '2026-01-01', archived_at: null,
          school_id: 'school-1', bank_id: bankId, author_id: 'author-1', course_id: null, subject_name: null,
          topic: null, subtopic: null, question_type: 'theory', status: 'active',
          current_version: { id: versionId, version_number: 1, created_at: '2026-01-01', created_by: 'creator-1', stimulus_id: null, plain_text: 'Explain.', content_blocks: [], explanation_blocks: [], grading_rubric_blocks: [], marks: 5, options: [] },
        }, error: null }, []))
    mocks.rpc.mockResolvedValue({ data: [{ question_id: questionId }], error: null })

    const bankResponse = await questionBanksRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Chemistry', visibility: 'private' }),
    })
    expect(bankResponse.status).toBe(201)
    expect((await bankResponse.json() as any).data).not.toHaveProperty('owner_id')

    const questionResponse = await questionBanksRouter.request(`/${bankId}/questions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question_type: 'theory', plain_text: 'Explain.', marks: 5 }),
    })
    expect(questionResponse.status).toBe(201)
    const question = (await questionResponse.json() as any).data
    expect(question).toMatchObject({ id: questionId, current_version: { id: versionId } })
    expect(question).not.toHaveProperty('bank_id')
    expect(question).not.toHaveProperty('author_id')
    expect(question.current_version).not.toHaveProperty('created_by')
  })
})

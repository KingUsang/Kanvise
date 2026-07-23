import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  download: vi.fn(async () => 'signed-download'),
  user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, createPresignedDownload: mocks.download }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { notesRouter, withoutPrivateFileKey } from './notes'

function query(result: any, inSpy = vi.fn(), eqSpy = vi.fn()) {
  const value: any = {
    select: () => value, eq: (...args: any[]) => { eqSpy(...args); return value },
    in: (...args: any[]) => { inSpy(...args); return value },
    order: () => value,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('student materials library security', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' } })

  it('rejects non-students before resolving enrolments', async () => {
    mocks.user.role = 'tutor'
    const response = await notesRouter.request('/me')
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('loads and signs notes only from entitled courses', async () => {
    const courseFilter = vi.fn()
    const enrolmentFilter = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null }, vi.fn(), enrolmentFilter)
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }, { id: 'course-2', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'notes') return query({ data: [{ id: 'note-1', file_key: 'private-key', course_id: 'course-1' }], error: null }, courseFilter)
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await notesRouter.request('/me')
    expect(response.status).toBe(200)
    expect(enrolmentFilter).toHaveBeenCalledWith('status', 'active')
    expect(courseFilter).toHaveBeenCalledWith('course_id', ['course-1'])
    expect(mocks.download).toHaveBeenCalledWith('private-key', 'school-1')
    const body = await response.json() as any
    expect(body.data[0]).not.toHaveProperty('file_key')
    expect(body.data[0].download_url).toBe('signed-download')
  })

  it('removes the private object key from material responses', () => {
    expect(withoutPrivateFileKey({
      id: 'note-1',
      file_key: 'school-1/private/note/course-1/secret.pdf',
      file_name: 'revision.pdf',
    })).toEqual({ id: 'note-1', file_name: 'revision.pdf' })
  })
})

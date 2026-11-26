import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  download: vi.fn(async () => 'signed-download'),
  user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any,
  account: { id: 'school-1', membershipId: 'membership-1' } as any,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, createPresignedDownload: mocks.download }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    const role = mocks.user.role === 'student' ? 'learner' : mocks.user.role
    c.set('account', { ...mocks.account, role })
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Insufficient role', code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { notesRouter, studentMaterialsSelect, withoutPrivateFileKey } from './notes'

function query(result: any, inSpy = vi.fn(), eqSpy = vi.fn()) {
  const value: any = {
    select: () => value, eq: (...args: any[]) => { eqSpy(...args); return value },
    in: (...args: any[]) => { inSpy(...args); return value },
    order: () => value,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('student materials library security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1' }
  })

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
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null }, vi.fn(), enrolmentFilter)
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }, { id: 'course-2', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'notes') return query({ data: [{ id: 'note-1', file_key: 'private-key', course_id: 'course-1' }], error: null }, courseFilter)
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await notesRouter.request('/me')
    expect(response.status).toBe(200)
    expect(enrolmentFilter).toHaveBeenCalledWith('student_id', 'student-1')
    expect(enrolmentFilter).toHaveBeenCalledWith('school_id', 'school-1')
    expect(enrolmentFilter).not.toHaveBeenCalledWith('status', 'active')
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

  it('keeps the library available when an old note key cannot be signed', async () => {
    mocks.download.mockRejectedValueOnce(new Error('old file key'))
    mocks.from.mockImplementation((table: string) => {
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'notes') return query({ data: [{ id: 'note-1', file_key: 'legacy-key', course_id: 'course-1' }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await notesRouter.request('/me')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: [{ id: 'note-1', download_url: null, download_available: false }] })
  })

  it('uses the notes course foreign key explicitly', () => {
    expect(studentMaterialsSelect).toContain('courses!notes_course_id_fkey')
  })

  it('denies a Tutor whose active account lacks the Subject assignment', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tutor_course_assignments') return query({ data: null, error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await notesRouter.request('/course-1')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    expect(mocks.from).not.toHaveBeenCalledWith('notes')
  })

  it('denies a Learner whose active account has no enrolment for the Subject', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'enrolments') return query({ data: [], error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-2', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await notesRouter.request('/course-1')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    expect(mocks.from).not.toHaveBeenCalledWith('notes')
  })

  it('keeps an Admin read scoped to the selected account', async () => {
    mocks.user = { id: 'admin-1', school_id: 'legacy-school', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1' }
    const noteFilters = vi.fn()
    const noteQuery = query({ data: [{ id: 'note-1', file_key: 'private-key', course_id: 'course-1' }], error: null }, vi.fn(), noteFilters)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'notes') return noteQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await notesRouter.request('/course-1')

    expect(response.status).toBe(200)
    expect(noteFilters).toHaveBeenCalledWith('school_id', 'account-1')
    expect(mocks.download).toHaveBeenCalledWith('private-key', 'account-1')
  })

  it('maps a download-provider failure to the safe materials error contract', async () => {
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    mocks.download.mockRejectedValueOnce(new Error('provider secret'))
    mocks.from.mockImplementation((table: string) => {
      if (table === 'notes') return query({ data: [{ id: 'note-1', file_key: 'private-key', course_id: 'course-1' }], error: null })
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await notesRouter.request('/course-1')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Could not load learning materials', code: 'MATERIALS_LOAD_FAILED' })
  })
})

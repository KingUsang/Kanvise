import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), courseIds: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('./student-course-access', () => ({ loadStudentCourseIds: mocks.courseIds }))

import { classroomAccessError, resolveClassroomAccess } from './classroom-access'

function lookup(result: any, eqSpy: ReturnType<typeof vi.fn>) {
  const value: any = {
    select: () => value,
    eq: (...args: any[]) => { eqSpy(...args); return value },
    maybeSingle: async () => result,
  }
  return value
}

describe('classroom access tenancy (DEV-ACC-003)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scopes the class lookup to the active account', async () => {
    const eq = vi.fn()
    mocks.from.mockReturnValue(lookup({ data: null, error: null }, eq))
    await resolveClassroomAccess('class-1', { id: 'tutor-1', school_id: 'school-1', role: 'tutor' })
    expect(eq).toHaveBeenCalledWith('id', 'class-1')
    expect(eq).toHaveBeenCalledWith('school_id', 'school-1')
  })

  it('reports a class in another account as missing, not as a different account', async () => {
    mocks.from.mockReturnValue(lookup({ data: null, error: null }, vi.fn()))
    const result = await resolveClassroomAccess('class-1', { id: 'admin-1', school_id: 'school-2', role: 'admin' })
    expect(result).toEqual({ reason: 'missing' })
    expect(classroomAccessError('missing')).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('still reports database failures separately from missing classes', async () => {
    mocks.from.mockReturnValue(lookup({ data: null, error: { message: 'down' } }, vi.fn()))
    await expect(resolveClassroomAccess('class-1', { id: 'a', school_id: 'school-1', role: 'admin' })).resolves.toEqual({ reason: 'lookup_failed' })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), membership: vi.fn(), courseIds: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('./student-course-access', () => ({
  hasActiveLearnerMembership: mocks.membership,
  loadStudentCourseIds: mocks.courseIds,
}))

import { loadStudentMockAudience } from './student-mock-audience'

describe('student mock audience (DEV-ACC-002)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty audience without reading enrolments when the learner membership is not active', async () => {
    mocks.membership.mockResolvedValue(false)
    await expect(loadStudentMockAudience({ id: 'student-1', school_id: 'school-1' })).resolves.toEqual({ courseIds: [], programmeIds: [] })
    expect(mocks.membership).toHaveBeenCalledWith('student-1', 'school-1')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns enrolment programmes for an active learner membership', async () => {
    mocks.membership.mockResolvedValue(true)
    mocks.courseIds.mockResolvedValue(['course-1'])
    const result = { data: [{ programme_id: 'programme-1' }, { programme_id: null }], error: null }
    const value: any = { select: () => value, eq: () => value, then: (r: any) => Promise.resolve(result).then(r) }
    mocks.from.mockReturnValue(value)
    await expect(loadStudentMockAudience({ id: 'student-1', school_id: 'school-1' })).resolves.toEqual({ courseIds: ['course-1'], programmeIds: ['programme-1'] })
  })
})

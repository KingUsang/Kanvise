import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { notificationRepository } from './repository'

function query(result: unknown, spies: { or?: ReturnType<typeof vi.fn> } = {}) {
  const value: any = {
    select: () => value,
    eq: () => value,
    in: () => value,
    maybeSingle: () => Promise.resolve(result),
    or: (filter: string) => {
      spies.or?.(filter)
      return Promise.resolve(result)
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('notification recipient resolution', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes programme enrolments when notifying a class inside that programme', async () => {
    const enrolmentOr = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'courses') return query({
        data: { id: 'course-1', programme_id: 'programme-1', sub_programme_id: null }, error: null,
      })
      if (table === 'enrolments') return query({ data: [{ student_id: 'student-1' }], error: null }, { or: enrolmentOr })
      if (table === 'user_profiles') return query({
        data: [{ id: 'student-1', school_id: 'school-1', email: 'student@example.com', first_name: 'Ada' }], error: null,
      })
      throw new Error(`Unexpected table ${table}`)
    })

    await expect(notificationRepository.resolveRecipients('school-1', {
      enrolment: { type: 'course', id: 'course-1' },
    })).resolves.toEqual([{
      id: 'student-1', schoolId: 'school-1', email: 'student@example.com', firstName: 'Ada',
    }])
    expect(enrolmentOr).toHaveBeenCalledWith('course_id.eq.course-1,programme_id.eq.programme-1')
  })
})

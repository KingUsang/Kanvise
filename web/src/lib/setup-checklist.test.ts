import { describe, expect, it } from 'vitest'
import { buildSetupChecklist, SETUP_SHIPPED_STEP, type SetupFacts } from './setup-checklist'

const none: SetupFacts = { students: 0, courses: 0, lessons: 0, tutors: 0 }
const build = (overrides: Partial<Parameters<typeof buildSetupChecklist>[0]> = {}) =>
  buildSetupChecklist({ accountType: 'independent', facts: none, skippedSteps: [], ...overrides })

describe('setup checklist', () => {
  it('shows no rows yet, because every row opens a screen from a later build step', () => {
    expect(SETUP_SHIPPED_STEP).toBe(2)
    for (const accountType of ['independent', 'centre'] as const) {
      const checklist = build({ accountType })
      expect(checklist.rows).toEqual([])
      expect(checklist.total).toBe(0)
      expect(checklist.allDone).toBe(false)
    }
  })

  it('shows Add your students and Add a tutor once step 3 ships', () => {
    expect(build({ shippedStep: 3 }).rows.map((row) => row.id)).toEqual(['add_students'])
    expect(build({ accountType: 'centre', shippedStep: 3 }).rows.map((row) => row.id)).toEqual(['add_tutor', 'add_students'])
  })

  it('counts n of the rows shown, not of five', () => {
    const checklist = build({ shippedStep: 3, facts: { ...none, students: 2 } })
    expect(checklist.label).toBe('1/1 completed')
    expect(checklist.allDone).toBe(true)
    const partial = build({ accountType: 'centre', shippedStep: 3, facts: { ...none, tutors: 1 } })
    expect(partial.label).toBe('1/2 completed')
    expect(partial.rows.map((row) => [row.id, row.state, row.next])).toEqual([['add_tutor', 'done', false], ['add_students', 'todo', true]])
  })

  it('lists five rows for each account type once every step has shipped', () => {
    expect(build({ shippedStep: 5 }).rows.map((row) => row.id)).toEqual(['add_students', 'create_course', 'course_plan', 'schedule_lesson', 'check_classroom'])
    expect(build({ accountType: 'centre', shippedStep: 5 }).rows.map((row) => row.id)).toEqual(['add_tutor', 'add_students', 'create_course', 'course_plan', 'schedule_lesson'])
    expect(build({ shippedStep: 5 }).label).toBe('0/5 completed')
  })

  it('marks the first unfinished row Next and explains disabled buttons in text', () => {
    const checklist = build({ shippedStep: 5, facts: { ...none, students: 1 } })
    expect(checklist.rows.filter((row) => row.next).map((row) => row.id)).toEqual(['create_course'])
    expect(checklist.rows.find((row) => row.id === 'course_plan')?.disabledReason).toBe('Create a course first.')
    expect(checklist.rows.find((row) => row.id === 'schedule_lesson')?.disabledReason).toBe('Create a course first.')
    const withCourse = build({ shippedStep: 5, facts: { ...none, students: 1, courses: 1 } })
    expect(withCourse.rows.find((row) => row.id === 'course_plan')?.disabledReason).toBeNull()
  })

  it('counts a skipped course plan as complete, and only that step can be skipped', () => {
    const checklist = build({ shippedStep: 5, facts: { ...none, courses: 1 }, skippedSteps: ['course_plan', 'add_students'] })
    expect(checklist.rows.find((row) => row.id === 'course_plan')?.state).toBe('skipped')
    expect(checklist.rows.find((row) => row.id === 'add_students')?.state).toBe('todo')
    expect(checklist.completed).toBe(2)
  })

  it('leaves a row unticked when its count could not be read', () => {
    const checklist = build({ shippedStep: 3, facts: { ...none, students: null } })
    expect(checklist.rows[0].state).toBe('todo')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  adaptClassRecord,
  adaptLearnerDashboard,
  adaptSubjectLink,
  productTerms,
} from './product-terminology'

describe('product terminology compatibility adapters', () => {
  it('keeps the shared product vocabulary explicit', () => {
    expect(productTerms).toMatchObject({
      tutoringAccount: 'tutoring account',
      learner: 'Learner',
      class: 'Class',
      subject: 'Subject',
      session: 'Session',
    })
  })

  it('adapts legacy class and subject links without changing their IDs', () => {
    const productClass = adaptClassRecord({
      id: 'class-1',
      name: 'Physics coaching',
      is_published: true,
      teaching_mode: 'group',
      courses: [{ id: 'course-1', name: 'Physics' }],
    })
    const productSession = adaptSubjectLink({
      id: 'session-1',
      course_id: 'course-1',
      course: { id: 'course-1', name: 'Physics' },
    })

    expect(productClass.subjects).toEqual([{ id: 'course-1', name: 'Physics' }])
    expect(productClass).not.toHaveProperty('courses')
    expect(productSession.subject).toEqual({ id: 'course-1', name: 'Physics' })
    expect(productSession).not.toHaveProperty('course')
    expect(productSession.course_id).toBe('course-1')
  })

  it('maps the learner dashboard at the boundary while preserving the payload', () => {
    const dashboard = adaptLearnerDashboard({
      student: { first_name: 'Ada', last_name: 'Lovelace' },
      school: { name: 'Bright Minds' },
      capabilities: { hasCentreLearning: true, hasMarketplaceAccess: false },
      course_count: 1,
      next_class: null,
      upcoming_classes: [],
      assignments_due: [],
      recent_updates: [],
    })

    expect(dashboard.learner).toEqual({ first_name: 'Ada', last_name: 'Lovelace' })
    expect(dashboard.tutoringAccount).toEqual({ name: 'Bright Minds' })
    expect(dashboard.capabilities?.hasClassLearning).toBe(true)
    expect('student' in dashboard).toBe(false)
    expect('school' in dashboard).toBe(false)
  })

  it('keeps prohibited legacy copy out of the bounded shared surfaces', () => {
    const sharedSurfacePaths = [
      'src/components/dashboard/more-workspace-client.tsx',
      'src/components/student/student-shell.tsx',
      'src/components/dashboard/classes/class-workspace-client.tsx',
      'src/components/dashboard/schedule/classes-workspace.tsx',
      'src/components/dashboard/timetable/centre-timetable-client.tsx',
    ]
    const prohibitedCopy = [
      'Opening centre tools',
      'centre-wide',
      'organisation settings',
      'Student portal',
      'Student navigation',
      'Student evidence',
      'Total students',
      'Centre operations',
      'live class',
    ]

    for (const path of sharedSurfacePaths) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8').toLowerCase()
      for (const copy of prohibitedCopy) expect(source).not.toContain(copy.toLowerCase())
    }
  })
})

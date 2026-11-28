/*
 * The /setup checklist (02 SET-01 to SET-03). Rows exist for every step in the
 * spec, but a row is shown only once the screen it opens has shipped (HANDOFF
 * "Build order", hidden-links table). Counts read {n}/{rows shown} completed.
 */

export type SetupStepId = 'add_tutor' | 'add_students' | 'create_course' | 'course_plan' | 'schedule_lesson' | 'check_classroom'
export type SetupAccountType = 'independent' | 'centre'

/**
 * The highest build step whose screens are live. Step 3 ships Add students and
 * Add a tutor, step 4 courses and lessons, step 5 the classroom check.
 * Raise this when those steps merge.
 */
export const SETUP_SHIPPED_STEP = 2

export type SetupFacts = {
  students: number | null
  courses: number | null
  lessons: number | null
  tutors: number | null
}

export type SetupRowDefinition = {
  id: SetupStepId
  title: string
  time: string
  reason: string
  button: string
  /** Where the button goes. */
  href: string
  /** The build step that ships the screen this row opens. */
  ships: number
  /** Only the course plan can be skipped. */
  skippable?: boolean
  /** Disabled until a course exists. */
  needsCourse?: boolean
}

const addStudents: SetupRowDefinition = {
  id: 'add_students', title: 'Add your students', time: '2 mins', ships: 3, href: '/dashboard/students',
  reason: 'Students are the people you teach. They get their lessons, homework and summaries in Kanvise.',
  button: 'Add students',
}

export const independentSetupRows: SetupRowDefinition[] = [
  addStudents,
  { id: 'create_course', title: 'Create a course', time: '2 mins', ships: 4, href: '/dashboard/classes', reason: 'A course pairs a student with you over time.', button: 'Create course' },
  { id: 'course_plan', title: 'Build the course plan', time: '2 mins', ships: 4, href: '/dashboard/classes', reason: "The topics you'll teach, so every lesson and summary ticks them off.", button: 'Build plan', skippable: true, needsCourse: true },
  { id: 'schedule_lesson', title: 'Schedule your first lesson', time: '1 min', ships: 4, href: '/dashboard/schedule', reason: 'Put it on the calendar and your student gets their join link.', button: 'Schedule lesson', needsCourse: true },
  { id: 'check_classroom', title: 'Check your classroom', time: '1 min', ships: 5, href: '/dashboard', reason: 'Test your camera, microphone and speakers before a student is waiting.', button: 'Test classroom' },
]

export const agencySetupRows: SetupRowDefinition[] = [
  { id: 'add_tutor', title: 'Add a tutor', time: '1 min', ships: 3, href: '/dashboard/tutors', reason: 'Tutors run the lessons. Add a colleague, or turn on I teach too if you teach.', button: 'Add tutor' },
  addStudents,
  { id: 'create_course', title: 'Create a course', time: '2 mins', ships: 4, href: '/dashboard/classes', reason: 'A course pairs a student with a tutor over time.', button: 'Create course' },
  { id: 'course_plan', title: 'Build the course plan', time: '2 mins', ships: 4, href: '/dashboard/classes', reason: 'The topics the course will cover, so lessons and summaries tick them off.', button: 'Build plan', skippable: true, needsCourse: true },
  { id: 'schedule_lesson', title: 'Schedule the first lesson', time: '1 min', ships: 4, href: '/dashboard/schedule', reason: 'Put it on the calendar; the tutor and students get their links.', button: 'Schedule lesson', needsCourse: true },
]

export type SetupRowState = 'done' | 'skipped' | 'todo'

export type SetupRow = SetupRowDefinition & {
  state: SetupRowState
  /** The first unfinished row. */
  next: boolean
  /** Why the button is disabled, as text (SET-01 rules). */
  disabledReason: string | null
}

export type SetupChecklist = {
  rows: SetupRow[]
  /** Rows done or skipped. */
  completed: number
  /** Rows shown. */
  total: number
  /** True when at least one row is shown and all are done or skipped. */
  allDone: boolean
  /** "{n}/{rows shown} completed" */
  label: string
}

/** Facts that tick a row. A count that could not be read leaves the row unticked. */
function isDone(id: SetupStepId, facts: SetupFacts) {
  switch (id) {
    case 'add_students': return (facts.students ?? 0) > 0
    case 'add_tutor': return (facts.tutors ?? 0) > 0
    case 'create_course': return (facts.courses ?? 0) > 0
    case 'schedule_lesson': return (facts.lessons ?? 0) > 0
    // The course plan and classroom check have no stored fact yet. They ship with
    // build steps 4 and 5, which add the topic and device check reads.
    case 'course_plan':
    case 'check_classroom':
      return false
  }
}

export function buildSetupChecklist({
  accountType,
  facts,
  skippedSteps,
  shippedStep = SETUP_SHIPPED_STEP,
}: {
  accountType: SetupAccountType
  facts: SetupFacts
  skippedSteps: string[]
  shippedStep?: number
}): SetupChecklist {
  const definitions = (accountType === 'independent' ? independentSetupRows : agencySetupRows).filter((row) => row.ships <= shippedStep)
  const hasCourse = (facts.courses ?? 0) > 0
  let nextTaken = false
  const rows: SetupRow[] = definitions.map((definition) => {
    const skipped = Boolean(definition.skippable) && skippedSteps.includes(definition.id)
    const done = !skipped && isDone(definition.id, facts)
    const state: SetupRowState = done ? 'done' : skipped ? 'skipped' : 'todo'
    const next = state === 'todo' && !nextTaken
    if (next) nextTaken = true
    return {
      ...definition,
      state,
      next,
      disabledReason: state === 'todo' && definition.needsCourse && !hasCourse ? 'Create a course first.' : null,
    }
  })
  const completed = rows.filter((row) => row.state !== 'todo').length
  return {
    rows,
    completed,
    total: rows.length,
    allDone: rows.length > 0 && completed === rows.length,
    label: `${completed}/${rows.length} completed`,
  }
}

export type SetupState =
  | { eligible: false }
  | { eligible: true; accountType: SetupAccountType; skippedSteps: string[]; hasStudentsAnswer: boolean; facts: SetupFacts }

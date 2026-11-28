'use client'

import { useState } from 'react'
import { DashboardHomeSkeleton, DashboardHomeView } from '@/components/dashboard/home/dashboard-home-view'
import { buildSetupChecklist } from '@/lib/setup-checklist'
import type { DashboardOverview, LessonDisplayStatus, OverviewLesson } from '@/lib/dashboard-overview'
import { ShellPreview } from '../shell/shell-preview'

type Role = 'independent' | 'tutor' | 'admin'
type DataState = 'populated' | 'empty' | 'quiet-today' | 'loading'

const TIMEZONE = 'Africa/Lagos'
const OFFSET = '+01:00'
const DAY = 86_400_000

// A fixed Wednesday, so every shot shows lessons later in the week and the
// screenshots match from run to run. Lagos has no daylight saving.
const SAMPLE_TODAY = Date.UTC(2026, 10, 25)
function lagosDate(offsetDays: number) {
  return new Date(SAMPLE_TODAY + offsetDays * DAY).toISOString().slice(0, 10)
}
function at(date: string, time: string) {
  return `${date}T${time}:00${OFFSET}`
}

type Sample = { title: string; course: string; students: number | null; tutor: string; time: string; minutes: number; status: LessonDisplayStatus }

const todaySamples: Sample[] = [
  { title: 'Quadratics revision', course: 'Algebra 1 Small Group', students: 2, tutor: 'Michael Chen', time: '09:00', minutes: 45, status: 'complete' },
  { title: 'Cell structure', course: 'Biology Basics', students: 3, tutor: 'Chidi Okafor', time: '11:00', minutes: 60, status: 'starting-soon' },
  { title: 'Essay planning', course: 'English Writing', students: 2, tutor: 'Michael Chen', time: '14:30', minutes: 45, status: 'planned' },
  { title: 'Forces and motion', course: 'Physics Foundations', students: 1, tutor: 'Chidi Okafor', time: '16:00', minutes: 60, status: 'planned' },
]
const laterSamples: Array<Sample & { day: number }> = [
  { day: 1, title: 'Solving Systems of Linear Equations', course: 'Algebra 1 Small Group', students: 2, tutor: 'Michael Chen', time: '10:00', minutes: 45, status: 'planned' },
  { day: 2, title: 'Photosynthesis', course: 'Biology Basics', students: 3, tutor: 'Chidi Okafor', time: '13:00', minutes: 60, status: 'planned' },
  { day: 2, title: 'Poetry analysis', course: 'English Writing', students: 2, tutor: 'Michael Chen', time: '15:30', minutes: 45, status: 'planned' },
  { day: 4, title: 'Electric circuits', course: 'Physics Foundations', students: 1, tutor: 'Chidi Okafor', time: '09:30', minutes: 60, status: 'planned' },
]

function toLesson(sample: Sample, id: string, date: string): OverviewLesson {
  return {
    id,
    title: sample.title,
    scheduled_at: at(date, sample.time),
    duration_minutes: sample.minutes,
    status: sample.status,
    course_id: `course-${sample.course}`,
    course_name: sample.course,
    student_count: sample.students,
    tutor_id: sample.tutor,
    tutor_name: sample.tutor,
  }
}

function buildOverview(role: Role, data: DataState, mine: boolean): DashboardOverview {
  const today = lagosDate(0)
  // Monday first, as the API returns it.
  const todayIndex = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const dates = Array.from({ length: 7 }, (_, index) => lagosDate(index - todayIndex))
  const view = role === 'admin' ? 'agency_admin' : role === 'tutor' ? 'agency_tutor' : 'independent'
  const scope = role === 'admin' && !mine ? 'all' : 'own'
  // Sample names from 00-decisions section 13. The admin teaches too, so Mine only keeps Chidi's lessons.
  const ownName = role === 'admin' ? 'Chidi Okafor' : 'Michael Chen'
  const keep = (sample: Sample) => scope === 'all' || role === 'independent' || sample.tutor === ownName

  const empty = data === 'empty'
  const todayLessons = empty || data === 'quiet-today' ? [] : todaySamples.filter(keep).map((sample, index) => toLesson(sample, `today-${index}`, today))
  const weekLessons: Array<OverviewLesson & { day_index: number }> = empty
    ? []
    : [
        ...todayLessons.map((lesson) => ({ ...lesson, day_index: todayIndex })),
        ...laterSamples
          .filter(keep)
          .map((sample, index) => ({ sample, index, day_index: Math.min(6, todayIndex + sample.day) }))
          .filter(({ day_index }) => day_index > todayIndex || data === 'quiet-today')
          .map(({ sample, index, day_index }) => ({ ...toLesson(sample, `later-${index}`, dates[day_index]), day_index })),
      ]
  const nextLesson = empty ? null : weekLessons.find((lesson) => lesson.day_index > todayIndex) ?? null
  return {
    view,
    teaches: true,
    scope,
    timezone: TIMEZONE,
    classroom_opens_minutes: 15,
    has_any_lesson: !empty,
    today: todayLessons,
    next_lesson: nextLesson,
    week: {
      offset: 0,
      today_index: todayIndex,
      days: dates.map((date, index) => ({ date, lesson_count: weekLessons.filter((lesson) => lesson.day_index === index).length })),
      lessons: weekLessons,
    },
  }
}

// Setup card with the step 3 and 4 rows shown, so the card has something to count.
function sampleSetup(role: Role) {
  const checklist = buildSetupChecklist({
    accountType: role === 'independent' ? 'independent' : 'centre',
    facts: { students: 2, courses: 0, lessons: 0, tutors: 2 },
    skippedSteps: [],
    shippedStep: 5,
  })
  return { completed: checklist.completed, total: checklist.total, label: checklist.label }
}

const noop = () => undefined

export function DashboardPreview({ role, data, setup, mine }: { role: Role; data: DataState; setup: boolean; mine: boolean }) {
  const [mineOnly, setMineOnly] = useState(mine)
  // 10:50 local on the sample day, so the greeting and "starting soon" read the same on every run.
  const now = new Date(at(lagosDate(0), '10:50'))
  const content = data === 'loading'
    ? <DashboardHomeSkeleton />
    : (
      <DashboardHomeView
        overview={buildOverview(role, data, mineOnly)}
        firstName={role === 'admin' ? 'Chidi' : role === 'tutor' ? 'Michael' : 'Alex'}
        now={now}
        mineOnly={mineOnly}
        onMineOnlyChange={setMineOnly}
        onWeekChange={noop}
      />
    )
  return (
    <ShellPreview
      options={{
        role: role === 'admin' ? 'admin' : role,
        rail: false,
        long: false,
        read: true,
        pending: 0,
        signedOut: false,
        path: '/dashboard',
        badge: '0',
      }}
      content={content}
      setup={setup ? sampleSetup(role) : null}
    />
  )
}

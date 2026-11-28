// Types and wording helpers for the dashboard frame (03-dashboard DB-01 to DB-04).

export type LessonDisplayStatus = 'planned' | 'starting-soon' | 'live' | 'complete' | 'not-held' | 'cancelled'

export type OverviewLesson = {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  status: LessonDisplayStatus
  course_id: string | null
  course_name: string | null
  student_count: number | null
  tutor_id: string
  tutor_name: string | null
}

export type DashboardOverview = {
  view: 'independent' | 'agency_tutor' | 'agency_admin'
  teaches: boolean
  scope: 'all' | 'own'
  timezone: string
  classroom_opens_minutes: number
  has_any_lesson: boolean
  today: OverviewLesson[]
  next_lesson: OverviewLesson | null
  week: {
    offset: number
    today_index: number
    days: Array<{ date: string; lesson_count: number }>
    lessons: Array<OverviewLesson & { day_index: number }>
  }
}

export function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function localHour(at: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(at)
  return Number(hour)
}

/** "Friday, 27 November 2026" */
export function formatDateLine(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(at)
}

/** "3:00 PM" */
export function formatTime(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone }).format(new Date(iso))
}

export function lessonEnd(lesson: Pick<OverviewLesson, 'scheduled_at' | 'duration_minutes'>) {
  return new Date(new Date(lesson.scheduled_at).getTime() + lesson.duration_minutes * 60_000)
}

/** "Monday, 10:00 AM" for the next-lesson line. */
export function formatNextLesson(iso: string, timeZone: string) {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone }).format(new Date(iso))
  return `${day}, ${formatTime(iso, timeZone)}`
}

/** A calendar date key (YYYY-MM-DD) read as that day, whatever the viewer's zone. */
function dayDate(date: string) {
  return new Date(`${date}T12:00:00Z`)
}

export function weekdayName(date: string, style: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat('en-GB', { weekday: style, timeZone: 'UTC' }).format(dayDate(date))
}

export function dayOfMonth(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' }).format(dayDate(date))
}

/** "23 to 29 November" for the week arrows. */
export function weekRangeLabel(firstDate: string, lastDate: string) {
  const month = (date: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(dayDate(date))
  const first = dayOfMonth(firstDate)
  const last = dayOfMonth(lastDate)
  return month(firstDate) === month(lastDate)
    ? `${first} to ${last} ${month(lastDate)}`
    : `${first} ${month(firstDate)} to ${last} ${month(lastDate)}`
}

export function pluralLessons(count: number) {
  return `${count} ${count === 1 ? 'lesson' : 'lessons'}`
}

export function pluralStudents(count: number) {
  return `${count} ${count === 1 ? 'student' : 'students'}`
}

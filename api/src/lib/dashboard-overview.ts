// Pure helpers for GET /dashboard/overview (03-dashboard DB-03, DB-04).

/** 12 CFG-L default. The setting itself ships with Settings in a later step. */
export const DEFAULT_CLASSROOM_OPENS_MINUTES = 15

export type LessonDisplayStatus =
  | 'planned'
  | 'starting-soon'
  | 'live'
  | 'complete'
  | 'not-held'
  | 'cancelled'

type LessonTiming = { status: string; scheduled_at: string; duration_minutes: number }

/**
 * Maps a stored lesson state to the chip words of DB-03. The classroom opens
 * for students `opensMinutes` before the start; that moment turns Planned into
 * Starting soon. A scheduled lesson whose end has passed was never held.
 */
export function lessonDisplayStatus(
  lesson: LessonTiming,
  now: Date,
  opensMinutes = DEFAULT_CLASSROOM_OPENS_MINUTES,
): LessonDisplayStatus {
  switch (lesson.status) {
    case 'cancelled':
      return 'cancelled'
    case 'live':
    case 'ending':
      return 'live'
    case 'starting':
    case 'ready':
      return 'starting-soon'
    case 'completed':
    case 'interrupted':
      return 'complete'
  }
  const start = new Date(lesson.scheduled_at).getTime()
  const end = start + lesson.duration_minutes * 60_000
  if (now.getTime() >= end) return 'not-held'
  return now.getTime() >= start - opensMinutes * 60_000 ? 'starting-soon' : 'planned'
}

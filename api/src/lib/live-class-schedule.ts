import { z } from 'zod'

/**
 * One runtime contract for scheduling a Session. Create, update and cancel
 * share these field schemas so a Session cannot be mutated into a state that
 * creation would reject (DEV-LVC-002, DEV-LVC-030).
 */
export const LIVE_CLASS_STATUSES = ['scheduled', 'starting', 'ready', 'live', 'ending', 'completed', 'cancelled', 'interrupted'] as const

export const ACCESS_MODES = ['enrolled_learners', 'anyone_with_link'] as const

const isValidTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const idSchema = z.string().trim().min(1).max(64)

export const titleSchema = z.string().trim().min(1, 'Title is required').max(200)
export const durationSchema = z.number().int().min(15).max(240)
// Normalised to a canonical UTC ISO string so equality checks are reliable.
export const scheduledAtSchema = z.string().trim().max(64)
  .refine((value) => Number.isFinite(new Date(value).getTime()), 'Invalid date')
  .transform((value) => new Date(value).toISOString())
  .refine((value) => new Date(value).getTime() >= Date.now(), 'SCHEDULED_IN_PAST')
export const cancelReasonSchema = z.string().trim().min(1).max(500)

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().startsWith(value), 'Invalid date')
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const createLiveClassSchema = z.object({
  course_id: idSchema.optional(),
  tutor_id: idSchema.optional(),
  title: titleSchema,
  scheduled_at: scheduledAtSchema,
  duration_minutes: durationSchema,
  access_mode: z.enum(ACCESS_MODES).default('enrolled_learners'),
  recurrence: z.enum(['once', 'weekly']).default('once'),
  recurrence_days: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  starts_on: dateOnly.optional(),
  start_time: timeOnly.optional(),
  timezone: z.string().trim().min(1).max(64).refine(isValidTimezone, 'Invalid timezone').optional(),
}).superRefine((value, ctx) => {
  if (value.recurrence !== 'weekly') return
  for (const key of ['starts_on', 'start_time', 'timezone'] as const) {
    if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required for a weekly series' })
  }
})

export const updateLiveClassSchema = z.object({
  title: titleSchema.optional(),
  scheduled_at: scheduledAtSchema.optional(),
  duration_minutes: durationSchema.optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), 'At least one field is required')

export function weekdayOf(startsOn: string) {
  return new Date(`${startsOn}T12:00:00Z`).getUTCDay() || 7
}

export function createIssueCode(error: z.ZodError, body: Record<string, unknown>) {
  if (['title', 'scheduled_at', 'duration_minutes'].some((key) => body[key] === undefined || body[key] === null)) return 'MISSING_FIELDS'
  if (error.issues.some((issue) => issue.message === 'SCHEDULED_IN_PAST')) return 'SCHEDULED_IN_PAST'
  if (error.issues.some((issue) => issue.path[0] === 'duration_minutes')) return 'INVALID_DURATION'
  return 'VALIDATION_ERROR'
}

export function updateIssueCode(error: z.ZodError) {
  return error.issues.some((issue) => issue.message === 'SCHEDULED_IN_PAST') ? 'SCHEDULED_IN_PAST' : 'VALIDATION_ERROR'
}

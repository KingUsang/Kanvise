import type { EmailEventName, EmailTemplateInputs } from '../emails/types'
import type { NotificationEvent } from './types'

/**
 * The notification rows a person can switch, and how every message that exists
 * today is classified (18 NTF-01, 12 CFG-N, 09 SA-10).
 *
 * A row is one switch with a Push and an Email value. `screen` says where the
 * row will be shown: CFG-N (step 9) and SA-10 (step 3) are not built yet, and
 * 'internal' rows are never shown in a settings screen. They exist so that an
 * email with no NTF-01 entry still has an unsubscribe link (00 section 19).
 *
 * `emailLabel` completes the unsubscribe page sentence:
 * "You won't get {emailLabel} emails any more." (18 NTF-04).
 */
export type NotificationRowAudience =
  | 'teaches'
  | 'agency_tutor_or_teaching_admin'
  | 'agency_admin'
  | 'student'
  | 'staff'

export type NotificationRow = {
  title: string
  emailLabel: string | null
  audience: NotificationRowAudience
  screen: 'CFG-N' | 'SA-10' | 'internal'
  channels: ReadonlyArray<'push' | 'email'>
  defaults: { push: boolean; email: boolean }
  /** 'person' rows belong to no account (school_id is NULL in the database). */
  scope: 'account' | 'person'
  note?: string
}

export const notificationRows = {
  // 12 CFG-N, in the spec's order.
  my_lesson_reminders: {
    title: 'Lesson reminder before my lesson', emailLabel: 'lesson reminder', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: true }, scope: 'account',
  },
  student_waiting: {
    title: 'A student is waiting for my lesson', emailLabel: 'student waiting', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: false }, scope: 'account',
  },
  lesson_not_started: {
    title: "My lesson hasn't started on time", emailLabel: 'late lesson', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: true }, scope: 'account',
  },
  student_lesson_messages: {
    title: 'A student sent a message about a lesson', emailLabel: 'lesson message', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: false }, scope: 'account',
  },
  homework_handed_in: {
    title: 'Homework handed in', emailLabel: 'homework handed in', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: false }, scope: 'account',
  },
  quiz_finished: {
    title: 'Quiz finished', emailLabel: 'quiz finished', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: false }, scope: 'account',
  },
  starting_check_finished: {
    title: 'Starting check finished', emailLabel: 'starting check', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: true }, scope: 'account',
  },
  summary_to_write: {
    title: 'Summary still to write (after 24 h)', emailLabel: 'summary reminder', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: true }, scope: 'account',
  },
  kavi_draft_ready: {
    title: "Kavi's draft is ready", emailLabel: 'Kavi draft', audience: 'teaches', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: false }, scope: 'account',
    note: 'Shown once Kavi exists.',
  },
  courses_given_to_me: {
    title: 'Courses given to me', emailLabel: 'new course', audience: 'agency_tutor_or_teaching_admin', screen: 'CFG-N',
    channels: ['push', 'email'], defaults: { push: true, email: true }, scope: 'account',
  },
  daily_summary: {
    title: 'Daily summary for admins', emailLabel: 'daily summary', audience: 'agency_admin', screen: 'CFG-N',
    channels: ['email'], defaults: { push: false, email: true }, scope: 'account',
  },

  // 09 SA-10: the student's two switches.
  student_push: {
    title: 'Push', emailLabel: null, audience: 'student', screen: 'SA-10',
    channels: ['push'], defaults: { push: true, email: false }, scope: 'account',
  },
  lesson_reminders: {
    title: 'Email reminders', emailLabel: 'lesson reminder', audience: 'student', screen: 'SA-10',
    channels: ['email'], defaults: { push: false, email: true }, scope: 'account',
  },

  // Internal rows for emails that exist on staging but have no NTF-01 email.
  homework_emails: {
    title: 'Homework emails', emailLabel: 'homework', audience: 'student', screen: 'internal',
    channels: ['email'], defaults: { push: false, email: true }, scope: 'account',
    note: 'Homework due tomorrow and homework marked emails. NTF-401 and NTF-405 replace them in step 6.',
  },
  quiz_emails: {
    title: 'Quiz emails', emailLabel: 'quiz', audience: 'student', screen: 'internal',
    channels: ['email'], defaults: { push: false, email: true }, scope: 'account',
    note: 'Mock published and mock results emails. NTF-407 replaces them in step 6.',
  },
  kanvise_tips: {
    title: 'Kanvise tips', emailLabel: 'Kanvise tip', audience: 'staff', screen: 'internal',
    channels: ['email'], defaults: { push: false, email: true }, scope: 'person',
    note: 'The onboarding emails Kanvise sends to new tutors and admins. Not shown in settings until step 9.',
  },
} as const satisfies Record<string, NotificationRow>

export type NotificationRowKey = keyof typeof notificationRows

export function isNotificationRowKey(value: unknown): value is NotificationRowKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(notificationRows, value)
}

/** The row's starting value for a channel when the person never changed it. */
export function rowDefault(row: NotificationRowKey, channel: 'push' | 'email'): boolean {
  return notificationRows[row].defaults[channel]
}

/** "lesson reminder" for "You won't get lesson reminder emails any more." */
export function rowEmailLabel(row: NotificationRowKey): string {
  return notificationRows[row].emailLabel ?? 'these'
}

/**
 * 'always' messages can't be switched off (NTF-01 Default **Always**). An
 * essential email says why it was sent instead of carrying an unsubscribe link.
 */
export type EmailClassification<K extends EmailEventName> =
  | { kind: 'always'; ntf: string | null; reason: (input: EmailTemplateInputs[K]) => string }
  | { kind: 'switchable'; ntf: string | null; row: NotificationRowKey }

function clean(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Every email template that exists today. The judgement for each one is in
 * the FEAT-007 findings; the short version is in the comment beside it.
 */
export const emailClassification: { [K in EmailEventName]: EmailClassification<K> } = {
  // NTF-104: a tutor needs the invitation to take part.
  tutor_invitation: {
    kind: 'always', ntf: 'NTF-104',
    reason: (input) => `You're getting this because ${clean(input.invitedByName)} invited you to teach with ${clean(input.schoolName)} on Kanvise.`,
  },
  // NTF-101.
  student_invitation: {
    kind: 'always', ntf: 'NTF-101',
    reason: (input) => `You're getting this because ${clean(input.invitedByName)} invited you to Kanvise.`,
  },
  // No NTF-01 entry. It confirms the account the person just made, so it is
  // essential, like the password emails (NTF-113, NTF-114).
  welcome: {
    kind: 'always', ntf: null,
    reason: () => "You're getting this because you just joined Kanvise.",
  },
  // No NTF-01 entry (payments are spec 13). A receipt is essential.
  payment_confirmed: {
    kind: 'always', ntf: null,
    reason: (input) => `You're getting this because you paid ${clean(input.schoolName)} through Kanvise.`,
  },
  // NTF-207: students switch it in SA-10 Email reminders.
  live_class_reminder: { kind: 'switchable', ntf: 'NTF-207', row: 'lesson_reminders' },
  // NTF-204: always.
  class_cancellation: {
    kind: 'always', ntf: 'NTF-204',
    reason: (input) => `You're getting this because ${clean(input.schoolName)} teaches you on Kanvise.`,
  },
  // An automatic "due tomorrow" email. NTF-01 has no automatic homework chase,
  // so it is switchable under an internal row.
  assignment_deadline: { kind: 'switchable', ntf: null, row: 'homework_emails' },
  // NTF-405 is Bell and Push only; the email that exists today is switchable.
  submission_graded: { kind: 'switchable', ntf: 'NTF-405', row: 'homework_emails' },
  // NTF-407 (Quiz set) is Bell and Push only; the email is switchable.
  mock_published: { kind: 'switchable', ntf: 'NTF-407', row: 'quiz_emails' },
  // No NTF-01 entry for a quiz result email; switchable with the quiz emails.
  mock_fully_graded: { kind: 'switchable', ntf: null, row: 'quiz_emails' },
  // Onboarding emails to new tutors and admins: no NTF-01 entry.
  founder_letter: { kind: 'switchable', ntf: null, row: 'kanvise_tips' },
  meet_kavi: { kind: 'switchable', ntf: null, row: 'kanvise_tips' },
  use_this_thing: { kind: 'switchable', ntf: null, row: 'kanvise_tips' },
  first_week: { kind: 'switchable', ntf: null, row: 'kanvise_tips' },
  kavi_challenge: { kind: 'switchable', ntf: null, row: 'kanvise_tips' },
  pilot_ending: { kind: 'switchable', ntf: null, row: 'kanvise_tips' },
}

/**
 * Which row switches each channel of a notification event. `'always'` means
 * the channel is never skipped for that event.
 */
export type ChannelRule = NotificationRowKey | 'always'

export const notificationChannelRows: Record<NotificationEvent, { push: ChannelRule; email: ChannelRule }> = {
  live_class_reminder: { push: 'student_push', email: 'lesson_reminders' },
  assignment_deadline: { push: 'student_push', email: 'homework_emails' },
  mock_published: { push: 'student_push', email: 'quiz_emails' },
  submission_graded: { push: 'student_push', email: 'homework_emails' },
  mock_fully_graded: { push: 'student_push', email: 'quiz_emails' },
  // NTF-204: a cancelled lesson is always sent on every channel.
  class_cancelled: { push: 'always', email: 'always' },
  // NTF-301 summary completed: push follows SA-10 Push; it has no email.
  class_recap_ready: { push: 'student_push', email: 'always' },
}

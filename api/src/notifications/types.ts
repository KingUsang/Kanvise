import type { EmailTemplateInputs } from '../emails/types'

export const notificationEmailEvents = {
  live_class_reminder: 'live_class_reminder',
  assignment_deadline: 'assignment_deadline',
  mock_published: 'mock_published',
  submission_graded: 'submission_graded',
  mock_fully_graded: 'mock_fully_graded',
  class_cancelled: 'class_cancellation',
  // Recap publication is currently in-app/push-only; the value keeps the
  // notification event type compatible with the existing email router if a
  // recap email is introduced later.
  class_recap_ready: 'live_class_reminder',
} as const

export type NotificationEvent = keyof typeof notificationEmailEvents
export type NotificationEmailEvent<K extends NotificationEvent> = typeof notificationEmailEvents[K]

export type NotificationRecipient = {
  id: string
  schoolId: string
  email: string | null
  firstName: string
}

export type RecipientSelector =
  | { recipientIds: string[] }
  | { school: true }
  | { enrolment: { type: 'programme' | 'sub_programme' | 'course'; id: string } }

export type NotificationRequest<K extends NotificationEvent> = {
  schoolId: string
  event: K
  recipients: RecipientSelector
  title: string
  body: string
  relatedEntityType: string
  relatedEntityId: string
  emailInput: (recipient: NotificationRecipient) => EmailTemplateInputs[NotificationEmailEvent<K>]
  telegramAction?: { text: string; url: string }
  push: { body: string; url: string }
  batchSize?: number
}

export type NotificationFailure = {
  recipientId: string
  channel: 'in_app' | 'email' | 'telegram' | 'push' | 'recipient'
  error: string
}

export type NotificationResult = {
  event: NotificationEvent
  recipients: number
  inAppCreated: number
  emailsSent: number
  emailsAlreadySent: number
  skippedNoEmail: number
  telegramSent: number
  telegramAlreadySent: number
  telegramSkipped: number
  pushSent: number
  pushAlreadySent: number
  pushSkipped: number
  failures: NotificationFailure[]
}

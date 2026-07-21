import { deliverNotification } from './service'
import type { NotificationRecipient, NotificationResult } from './types'

type Deliver = typeof deliverNotification

function frontendUrl(): string {
  const value = process.env.FRONTEND_URL?.replace(/\/$/, '')
  if (!value) throw new Error('FRONTEND_URL is required for notification links')
  return value
}

export function notifyMockPublished(input: {
  id: string; schoolId: string; courseId: string; title: string; courseName: string; closesAt?: string | null
}, deliver: Deliver = deliverNotification): Promise<NotificationResult> {
  return deliver({
    schoolId: input.schoolId,
    event: 'mock_published',
    recipients: { enrolment: { type: 'course', id: input.courseId } },
    title: 'New mock available',
    body: `${input.title} is now available.`,
    relatedEntityType: 'mock_exam',
    relatedEntityId: input.id,
    emailInput: (recipient: NotificationRecipient) => ({
      firstName: recipient.firstName,
      mockTitle: input.title,
      courseName: input.courseName,
      closesAt: input.closesAt || undefined,
      mockUrl: `${frontendUrl()}/dashboard/mocks/${input.id}`,
    }),
  })
}

export function notifySubmissionGraded(input: {
  id: string; schoolId: string; studentId: string; assignmentId: string; assignmentTitle: string
  score: string; feedback?: string | null
}, deliver: Deliver = deliverNotification): Promise<NotificationResult> {
  return deliver({
    schoolId: input.schoolId,
    event: 'submission_graded',
    recipients: { recipientIds: [input.studentId] },
    title: 'Submission graded',
    body: `Your submission for ${input.assignmentTitle} has been graded. Score: ${input.score}.`,
    relatedEntityType: 'submission',
    relatedEntityId: input.id,
    emailInput: (recipient: NotificationRecipient) => ({
      firstName: recipient.firstName,
      assignmentTitle: input.assignmentTitle,
      score: input.score,
      feedback: input.feedback || undefined,
      submissionUrl: `${frontendUrl()}/dashboard/submissions/${input.id}`,
    }),
  })
}

export function notifyMockFullyGraded(input: {
  attemptId: string; schoolId: string; studentId: string; mockId: string; mockTitle: string; score: string
}, deliver: Deliver = deliverNotification): Promise<NotificationResult> {
  return deliver({
    schoolId: input.schoolId,
    event: 'mock_fully_graded',
    recipients: { recipientIds: [input.studentId] },
    title: 'Mock results ready',
    body: `Your mock results for ${input.mockTitle} have been fully graded.`,
    relatedEntityType: 'mock_attempt',
    relatedEntityId: input.attemptId,
    emailInput: (recipient: NotificationRecipient) => ({
      firstName: recipient.firstName,
      mockTitle: input.mockTitle,
      score: input.score,
      resultsUrl: `${frontendUrl()}/dashboard/mocks/${input.mockId}/results/${input.attemptId}`,
    }),
  })
}

export function notifyClassCancelled(input: {
  id: string; schoolId: string; schoolName: string; courseId: string; title: string; scheduledAt: string; reason?: string
}, deliver: Deliver = deliverNotification): Promise<NotificationResult> {
  return deliver({
    schoolId: input.schoolId,
    event: 'class_cancelled',
    recipients: { enrolment: { type: 'course', id: input.courseId } },
    title: 'Class cancelled',
    body: `${input.title} scheduled for ${input.scheduledAt} has been cancelled.`,
    relatedEntityType: 'live_class',
    relatedEntityId: input.id,
    emailInput: (recipient: NotificationRecipient) => ({
      firstName: recipient.firstName,
      classTitle: input.title,
      scheduledAt: input.scheduledAt,
      schoolName: input.schoolName,
      dashboardUrl: `${frontendUrl()}/dashboard/schedule`,
      reason: input.reason,
    }),
  })
}

export function notifyLiveClassReminder(input: {
  id: string; schoolId: string; courseId: string; title: string; courseName: string; startsAt: string
}, deliver: Deliver = deliverNotification): Promise<NotificationResult> {
  return deliver({
    schoolId: input.schoolId,
    event: 'live_class_reminder',
    recipients: { enrolment: { type: 'course', id: input.courseId } },
    title: 'Class starts soon',
    body: `${input.title} starts soon.`,
    relatedEntityType: 'live_class',
    relatedEntityId: input.id,
    emailInput: (recipient: NotificationRecipient) => ({
      firstName: recipient.firstName,
      classTitle: input.title,
      courseName: input.courseName,
      startsAt: input.startsAt,
      joinUrl: `${frontendUrl()}/class/${input.id}`,
    }),
  })
}

export function notifyAssignmentDeadline(input: {
  id: string; schoolId: string; courseName: string; title: string; deadlineAt: string; recipientIds: string[]
}, deliver: Deliver = deliverNotification): Promise<NotificationResult> {
  return deliver({
    schoolId: input.schoolId,
    event: 'assignment_deadline',
    recipients: { recipientIds: input.recipientIds },
    title: 'Assignment due soon',
    body: `${input.title} is due in less than 24 hours.`,
    relatedEntityType: 'assignment',
    relatedEntityId: input.id,
    emailInput: (recipient: NotificationRecipient) => ({
      firstName: recipient.firstName,
      assignmentTitle: input.title,
      courseName: input.courseName,
      deadlineAt: input.deadlineAt,
      assignmentUrl: `${frontendUrl()}/dashboard/assignments/${input.id}`,
    }),
  })
}

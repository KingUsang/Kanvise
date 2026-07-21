export type TutorInvitationEmailInput = {
  inviteUrl: string
  invitedByName: string
  schoolName: string
  expiresAt: string
}

export type WelcomeEmailInput = {
  firstName: string
  dashboardUrl: string
}

export type PaymentConfirmedEmailInput = {
  firstName: string
  schoolName: string
  programmeName: string
  amount: string
  paymentReference: string
  paidAt: string
  dashboardUrl: string
}

export type LiveClassReminderEmailInput = {
  firstName: string
  classTitle: string
  courseName: string
  startsAt: string
  joinUrl: string
}

export type ClassCancellationEmailInput = {
  firstName: string
  classTitle: string
  scheduledAt: string
  schoolName: string
  dashboardUrl: string
  reason?: string
}

export type AssignmentDeadlineEmailInput = {
  firstName: string
  assignmentTitle: string
  courseName: string
  deadlineAt: string
  assignmentUrl: string
}

export type SubmissionGradedEmailInput = {
  firstName: string
  assignmentTitle: string
  score: string
  feedback?: string
  submissionUrl: string
}

export type MockPublishedEmailInput = {
  firstName: string
  mockTitle: string
  courseName: string
  closesAt?: string
  mockUrl: string
}

export type MockFullyGradedEmailInput = {
  firstName: string
  mockTitle: string
  score: string
  resultsUrl: string
}

export type EmailTemplateInputs = {
  tutor_invitation: TutorInvitationEmailInput
  welcome: WelcomeEmailInput
  payment_confirmed: PaymentConfirmedEmailInput
  live_class_reminder: LiveClassReminderEmailInput
  class_cancellation: ClassCancellationEmailInput
  assignment_deadline: AssignmentDeadlineEmailInput
  submission_graded: SubmissionGradedEmailInput
  mock_published: MockPublishedEmailInput
  mock_fully_graded: MockFullyGradedEmailInput
}

export type EmailEventName = keyof EmailTemplateInputs


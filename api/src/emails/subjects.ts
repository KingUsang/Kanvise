import type { EmailTemplateInputs } from './types'

function subjectValue(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export const emailSubjects = {
  tutor_invitation: (input: EmailTemplateInputs['tutor_invitation']) =>
    `You’re invited to teach at ${subjectValue(input.schoolName)}`,
  welcome: (input: EmailTemplateInputs['welcome']) =>
    `Welcome to Kanvise, ${subjectValue(input.firstName)}`,
  payment_confirmed: (input: EmailTemplateInputs['payment_confirmed']) =>
    `Payment confirmed — ${subjectValue(input.programmeName)}`,
  live_class_reminder: (input: EmailTemplateInputs['live_class_reminder']) =>
    `Class reminder: ${subjectValue(input.classTitle)}`,
  class_cancellation: (input: EmailTemplateInputs['class_cancellation']) =>
    `Class cancelled: ${subjectValue(input.classTitle)}`,
  assignment_deadline: (input: EmailTemplateInputs['assignment_deadline']) =>
    `Assignment due soon: ${subjectValue(input.assignmentTitle)}`,
  submission_graded: (input: EmailTemplateInputs['submission_graded']) =>
    `Your submission has been graded: ${subjectValue(input.assignmentTitle)}`,
  mock_published: (input: EmailTemplateInputs['mock_published']) =>
    `New mock available: ${subjectValue(input.mockTitle)}`,
  mock_fully_graded: (input: EmailTemplateInputs['mock_fully_graded']) =>
    `Your mock result is ready: ${subjectValue(input.mockTitle)}`,
} satisfies { [K in keyof EmailTemplateInputs]: (input: EmailTemplateInputs[K]) => string }


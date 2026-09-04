import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { emailSubjects } from './subjects'
import { AssignmentDeadlineEmail } from './templates/assignment-deadline'
import { ClassCancellationEmail } from './templates/class-cancellation'
import { LiveClassReminderEmail } from './templates/live-class-reminder'
import { MockFullyGradedEmail } from './templates/mock-fully-graded'
import { MockPublishedEmail } from './templates/mock-published'
import { PaymentConfirmedEmail } from './templates/payment-confirmed'
import { SubmissionGradedEmail } from './templates/submission-graded'
import { TutorInvitationEmail } from './templates/tutor-invitation'
import { WelcomeEmail } from './templates/welcome'
import type { EmailEventName, EmailTemplateInputs } from './types'

const linkFields: { [K in EmailEventName]: Array<keyof EmailTemplateInputs[K]> } = {
  tutor_invitation: ['inviteUrl'],
  welcome: ['dashboardUrl'],
  payment_confirmed: ['dashboardUrl'],
  live_class_reminder: ['joinUrl'],
  class_cancellation: ['dashboardUrl'],
  assignment_deadline: ['assignmentUrl'],
  submission_graded: ['submissionUrl'],
  mock_published: ['mockUrl'],
  mock_fully_graded: ['resultsUrl'],
}

function assertAbsoluteWebUrl(field: string, value: unknown): void {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
  } catch {
    throw new Error(`${field} must be an absolute HTTP(S) URL`)
  }
}

function buildEmail<K extends EmailEventName>(event: K, input: EmailTemplateInputs[K], logoUrl: string): ReactElement {
  switch (event) {
    case 'tutor_invitation': return <TutorInvitationEmail {...input as EmailTemplateInputs['tutor_invitation']} logoUrl={logoUrl} />
    case 'welcome': return <WelcomeEmail {...input as EmailTemplateInputs['welcome']} logoUrl={logoUrl} />
    case 'payment_confirmed': return <PaymentConfirmedEmail {...input as EmailTemplateInputs['payment_confirmed']} logoUrl={logoUrl} />
    case 'live_class_reminder': return <LiveClassReminderEmail {...input as EmailTemplateInputs['live_class_reminder']} logoUrl={logoUrl} />
    case 'class_cancellation': return <ClassCancellationEmail {...input as EmailTemplateInputs['class_cancellation']} logoUrl={logoUrl} />
    case 'assignment_deadline': return <AssignmentDeadlineEmail {...input as EmailTemplateInputs['assignment_deadline']} logoUrl={logoUrl} />
    case 'submission_graded': return <SubmissionGradedEmail {...input as EmailTemplateInputs['submission_graded']} logoUrl={logoUrl} />
    case 'mock_published': return <MockPublishedEmail {...input as EmailTemplateInputs['mock_published']} logoUrl={logoUrl} />
    case 'mock_fully_graded': return <MockFullyGradedEmail {...input as EmailTemplateInputs['mock_fully_graded']} logoUrl={logoUrl} />
  }
}

export async function renderEmail<K extends EmailEventName>(event: K, input: EmailTemplateInputs[K], logoUrl: string) {
  assertAbsoluteWebUrl('logoUrl', logoUrl)
  for (const field of linkFields[event]) {
    assertAbsoluteWebUrl(String(field), input[field])
  }

  const email = buildEmail(event, input, logoUrl)
  const subjectFactory = emailSubjects[event] as (value: EmailTemplateInputs[K]) => string
  return {
    subject: subjectFactory(input),
    html: await render(email),
    text: await render(email, { plainText: true }),
  }
}


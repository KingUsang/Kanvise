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
import { StudentInvitationEmail } from './templates/student-invitation'
import { WelcomeEmail } from './templates/welcome'
import { 
  WelcomePilotEmail, 
  FounderLetterEmail,
  MeetKaviEmail,
  LetUsUseThisEmail,
  FirstWeekEmail,
  KaviChallengeEmail,
  PilotEndingEmail
} from './templates/lifecycle'
import type { EmailEventName, EmailTemplateInputs } from './types'
import { emailClassification } from '../notifications/rows'
import { unsubscribeHeaders, type EmailFooter, type UnsubscribeLinks } from './footer'
import { DEFAULT_ACCOUNT_TIME_ZONE } from './format-email-time'
import type { EmailChrome } from './templates/shared'

export type RenderEmailOptions = {
  /** Required for every email that can be switched off (18 NTF-04). */
  unsubscribe?: UnsubscribeLinks
  /** The account's timezone (resolveAccountTimeZone). */
  timeZone?: string
}

const linkFields: { [K in EmailEventName]: Array<keyof EmailTemplateInputs[K]> } = {
  tutor_invitation: ['inviteUrl'],
  student_invitation: ['inviteUrl'],
  welcome: ['dashboardUrl'],
  payment_confirmed: ['dashboardUrl'],
  live_class_reminder: ['joinUrl'],
  class_cancellation: ['dashboardUrl'],
  assignment_deadline: ['assignmentUrl'],
  submission_graded: ['submissionUrl'],
  mock_published: ['mockUrl'],
  mock_fully_graded: ['resultsUrl'],
  founder_letter: ['actionUrl'],
  meet_kavi: ['actionUrl'],
  use_this_thing: ['actionUrl'],
  first_week: ['actionUrl'],
  kavi_challenge: ['actionUrl'],
  pilot_ending: ['actionUrl'],
}

function assertAbsoluteWebUrl(field: string, value: unknown): void {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
  } catch {
    throw new Error(`${field} must be an absolute HTTP(S) URL`)
  }
}

function buildEmail<K extends EmailEventName>(event: K, input: EmailTemplateInputs[K], chrome: EmailChrome): ReactElement {
  const { logoUrl, footer, timeZone } = chrome
  switch (event) {
    case 'tutor_invitation': return <TutorInvitationEmail {...input as EmailTemplateInputs['tutor_invitation']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'student_invitation': return <StudentInvitationEmail {...input as EmailTemplateInputs['student_invitation']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'welcome': {
      const w = input as EmailTemplateInputs['welcome']
      return w.role === 'admin' || w.role === 'tutor'
        ? <WelcomePilotEmail firstName={w.firstName} actionUrl={w.dashboardUrl} logoUrl={logoUrl} footer={footer} />
        : <WelcomeEmail {...w} logoUrl={logoUrl} footer={footer} />
    }
    case 'payment_confirmed': return <PaymentConfirmedEmail {...input as EmailTemplateInputs['payment_confirmed']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'live_class_reminder': return <LiveClassReminderEmail {...input as EmailTemplateInputs['live_class_reminder']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'class_cancellation': return <ClassCancellationEmail {...input as EmailTemplateInputs['class_cancellation']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'assignment_deadline': return <AssignmentDeadlineEmail {...input as EmailTemplateInputs['assignment_deadline']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'submission_graded': return <SubmissionGradedEmail {...input as EmailTemplateInputs['submission_graded']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'mock_published': return <MockPublishedEmail {...input as EmailTemplateInputs['mock_published']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'mock_fully_graded': return <MockFullyGradedEmail {...input as EmailTemplateInputs['mock_fully_graded']} logoUrl={logoUrl} footer={footer} timeZone={timeZone} />
    case 'founder_letter': return <FounderLetterEmail {...input as EmailTemplateInputs['founder_letter']} logoUrl={logoUrl} footer={footer} />
    case 'meet_kavi': return <MeetKaviEmail {...input as EmailTemplateInputs['meet_kavi']} logoUrl={logoUrl} footer={footer} />
    case 'use_this_thing': return <LetUsUseThisEmail {...input as EmailTemplateInputs['use_this_thing']} logoUrl={logoUrl} footer={footer} />
    case 'first_week': return <FirstWeekEmail {...input as EmailTemplateInputs['first_week']} logoUrl={logoUrl} footer={footer} />
    case 'kavi_challenge': return <KaviChallengeEmail {...input as EmailTemplateInputs['kavi_challenge']} logoUrl={logoUrl} footer={footer} />
    case 'pilot_ending': return <PilotEndingEmail {...input as EmailTemplateInputs['pilot_ending']} logoUrl={logoUrl} footer={footer} />
  }
}

/**
 * The footer comes from the email's classification (notifications/rows.ts):
 * essential emails say why they were sent, switchable ones must be given
 * unsubscribe links, and only they return List-Unsubscribe headers.
 */
function footerFor<K extends EmailEventName>(event: K, input: EmailTemplateInputs[K], options: RenderEmailOptions): {
  footer: EmailFooter
  headers?: Record<string, string>
} {
  const classification = emailClassification[event]
  if (classification.kind === 'always') return { footer: { kind: 'essential', reason: classification.reason(input) } }
  if (!options.unsubscribe) throw new Error(`${event} can be switched off, so it needs an unsubscribe link`)
  assertAbsoluteWebUrl('unsubscribe.pageUrl', options.unsubscribe.pageUrl)
  if (options.unsubscribe.oneClickUrl) assertAbsoluteWebUrl('unsubscribe.oneClickUrl', options.unsubscribe.oneClickUrl)
  return {
    footer: { kind: 'unsubscribe', unsubscribeUrl: options.unsubscribe.pageUrl },
    headers: unsubscribeHeaders(options.unsubscribe),
  }
}

export async function renderEmail<K extends EmailEventName>(
  event: K,
  input: EmailTemplateInputs[K],
  logoUrl: string,
  options: RenderEmailOptions = {},
) {
  assertAbsoluteWebUrl('logoUrl', logoUrl)
  for (const field of linkFields[event]) {
    assertAbsoluteWebUrl(String(field), input[field])
  }

  const { footer, headers } = footerFor(event, input, options)
  const email = buildEmail(event, input, { logoUrl, footer, timeZone: options.timeZone || DEFAULT_ACCOUNT_TIME_ZONE })
  const subjectFactory = emailSubjects[event] as (value: EmailTemplateInputs[K]) => string
  return {
    subject: subjectFactory(input),
    html: await render(email),
    text: await render(email, { plainText: true }),
    ...(headers ? { headers } : {}),
  }
}

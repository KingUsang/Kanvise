import { describe, expect, it } from 'vitest'
import { renderEmail } from './render-email'
import { emailSubjects } from './subjects'
import type { EmailEventName, EmailTemplateInputs } from './types'

const logoUrl = 'https://kanvise.com/kanvise_logo_small_blue.png'

const cases: Array<{
  event: EmailEventName
  input: EmailTemplateInputs[EmailEventName]
  expected: string[]
  link: string
}> = [
  {
    event: 'tutor_invitation',
    input: { inviteUrl: 'https://kanvise.com/join?token=abc', invitedByName: 'Ada Okafor', schoolName: 'Bright Minds', expiresAt: '2026-07-27T12:00:00Z' },
    expected: ['Ada Okafor', 'Bright Minds', 'TUTOR INVITATION'],
    link: 'https://kanvise.com/join?token=abc',
  },
  {
    event: 'welcome',
    input: { firstName: 'Chidi', dashboardUrl: 'https://kanvise.com/dashboard' },
    expected: ['Chidi', 'WELCOME TO KANVISE'],
    link: 'https://kanvise.com/dashboard',
  },
  {
    event: 'payment_confirmed',
    input: { firstName: 'Chidi', schoolName: 'Bright Minds', programmeName: 'WAEC Physics', amount: '₦25,000.00', paymentReference: 'PAY-123', paidAt: '2026-07-20T10:00:00Z', dashboardUrl: 'https://kanvise.com/dashboard' },
    expected: ['Bright Minds', 'WAEC Physics', '₦25,000.00', 'PAY-123'],
    link: 'https://kanvise.com/dashboard',
  },
  {
    event: 'live_class_reminder',
    input: { firstName: 'Chidi', classTitle: 'Newton’s Laws', courseName: 'Physics', startsAt: '2026-07-20T15:00:00Z', joinUrl: 'https://kanvise.com/class/class-1' },
    expected: ['Newton’s Laws', 'Physics', 'CLASS REMINDER'],
    link: 'https://kanvise.com/class/class-1',
  },
  {
    event: 'class_cancellation',
    input: { firstName: 'Chidi', classTitle: 'Organic Chemistry', scheduledAt: '2026-07-20T15:00:00Z', schoolName: 'Bright Minds', reason: 'Tutor unavailable', dashboardUrl: 'https://kanvise.com/dashboard' },
    expected: ['Organic Chemistry', 'Tutor unavailable', 'cancelled'],
    link: 'https://kanvise.com/dashboard',
  },
  {
    event: 'assignment_deadline',
    input: { firstName: 'Chidi', assignmentTitle: 'Essay One', courseName: 'English', deadlineAt: '2026-07-20T15:00:00Z', assignmentUrl: 'https://kanvise.com/assignments/1' },
    expected: ['Essay One', 'English', 'DEADLINE REMINDER'],
    link: 'https://kanvise.com/assignments/1',
  },
  {
    event: 'submission_graded',
    input: { firstName: 'Chidi', assignmentTitle: 'Essay One', score: '18/20', feedback: 'Strong argument', submissionUrl: 'https://kanvise.com/submissions/1' },
    expected: ['Essay One', '18/20', 'Strong argument'],
    link: 'https://kanvise.com/submissions/1',
  },
  {
    event: 'mock_published',
    input: { firstName: 'Chidi', mockTitle: 'WAEC Mock 1', courseName: 'Physics', closesAt: '2026-07-27T15:00:00Z', mockUrl: 'https://kanvise.com/mocks/1' },
    expected: ['WAEC Mock 1', 'Physics', 'NEW MOCK'],
    link: 'https://kanvise.com/mocks/1',
  },
  {
    event: 'mock_fully_graded',
    input: { firstName: 'Chidi', mockTitle: 'WAEC Mock 1', score: '84/100', resultsUrl: 'https://kanvise.com/mocks/1/results' },
    expected: ['WAEC Mock 1', '84/100', 'MOCK GRADED'],
    link: 'https://kanvise.com/mocks/1/results',
  },
]

describe('initial email templates', () => {
  it.each(cases)('renders HTML and plain text for $event', async ({ event, input, expected, link }) => {
    const result = await renderEmail(event, input as never, logoUrl)

    expect(result.subject).not.toBe('')
    expect(result.html).toContain(logoUrl)
    expect(result.html).toContain(link.replace(/&/g, '&amp;'))
    expect(result.text).toContain(link)
    for (const value of expected) {
      expect(`${result.html}\n${result.text}`).toContain(value)
    }
  })

  it('escapes user-provided markup in HTML while preserving it as text', async () => {
    const unsafeName = '<img src=x onerror=alert(1)>'
    const result = await renderEmail('welcome', {
      firstName: unsafeName,
      dashboardUrl: 'https://kanvise.com/dashboard',
    }, logoUrl)

    expect(result.html).not.toContain('<img src=x onerror=alert(1)>')
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(result.text).toContain(unsafeName.toUpperCase())
  })

  it('rejects relative and non-web links', async () => {
    await expect(renderEmail('welcome', {
      firstName: 'Chidi',
      dashboardUrl: '/dashboard',
    }, logoUrl)).rejects.toThrow('dashboardUrl must be an absolute HTTP(S) URL')

    await expect(renderEmail('welcome', {
      firstName: 'Chidi',
      dashboardUrl: 'javascript:alert(1)',
    }, logoUrl)).rejects.toThrow('dashboardUrl must be an absolute HTTP(S) URL')
  })

  it('removes control characters from centrally generated subjects', () => {
    expect(emailSubjects.welcome({ firstName: 'Ada\r\nBcc: attacker@example.com', dashboardUrl: 'https://kanvise.com' }))
      .toBe('Welcome to Kanvise, Ada Bcc: attacker@example.com')
  })
})

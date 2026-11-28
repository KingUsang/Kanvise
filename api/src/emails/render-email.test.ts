import { describe, expect, it } from 'vitest'
import { renderEmail } from './render-email'
import { emailSubjects } from './subjects'
import type { EmailEventName, EmailTemplateInputs } from './types'

const logoUrl = 'https://kanvise.com/kanvise_logo_small_blue.png'
const unsubscribe = {
  pageUrl: 'https://kanvise.com/unsubscribe?token=tok',
  oneClickUrl: 'https://api.kanvise.com/unsubscribe/one-click?token=tok',
}

const cases: Array<{
  event: EmailEventName
  input: EmailTemplateInputs[EmailEventName]
  expected: string[]
  link: string
}> = [
  {
    event: 'tutor_invitation',
    input: { inviteUrl: 'https://kanvise.com/invite?token=abc', invitedByName: 'Ada Okafor', schoolName: 'Bright Minds', expiresAt: '2026-07-27T12:00:00Z' },
    expected: ['Ada Okafor', 'Bright Minds'],
    link: 'https://kanvise.com/invite?token=abc',
  },
  {
    event: 'student_invitation',
    input: { inviteUrl: 'https://kanvise.com/invite?token=abc', invitedByName: 'Ada Okafor', schoolName: 'Bright Minds', programmeName: 'WAEC Physics', expiresAt: '2026-07-27T12:00:00Z' },
    expected: ['Ada Okafor', 'Bright Minds', 'WAEC Physics', 'reopen this same link'],
    link: 'https://kanvise.com/invite?token=abc',
  },
  {
    event: 'welcome',
    input: { firstName: 'Chidi', dashboardUrl: 'https://kanvise.com/dashboard' },
    expected: ['Chidi', 'Your Kanvise account is fully set up'],
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
    const result = await renderEmail(event, input as never, logoUrl, { unsubscribe })

    expect(result.subject).not.toBe('')
    expect(result.html).toContain(logoUrl)
    expect(result.html).toContain(link.replace(/&/g, '&amp;'))
    expect(result.text).toContain(link)
    for (const value of expected) {
      expect(`${result.html}\n${result.text}`).toContain(value)
    }
  })

  it('renders the dashboard action in the Tutor/Admin welcome (DEV-EML-007)', async () => {
    const result = await renderEmail('welcome', {
      firstName: 'Ada', role: 'tutor', dashboardUrl: 'https://kanvise.com/dashboard',
    } as any, logoUrl)
    expect(result.html).toContain('https://kanvise.com/dashboard')
  })

  it('escapes user-provided markup in HTML while preserving it as text', async () => {
    const unsafeName = '<img src=x onerror=alert(1)>'
    const result = await renderEmail('welcome', {
      firstName: unsafeName,
      dashboardUrl: 'https://kanvise.com/dashboard',
    }, logoUrl)

    expect(result.html).not.toContain('<img src=x onerror=alert(1)>')
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(result.text).toContain(unsafeName)
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

  it.each(['tutor_invitation', 'student_invitation', 'welcome', 'payment_confirmed', 'class_cancellation'] as const)(
    'essential %s says why it was sent and has no unsubscribe link or header',
    async (event) => {
      const input = cases.find((item) => item.event === event)!.input
      const result = await renderEmail(event, input as never, logoUrl, { unsubscribe })
      expect(result.text).toMatch(/You're getting this because|You’re getting this because/)
      expect(result.html).not.toContain('unsubscribe?token')
      expect(result.text).not.toContain('Unsubscribe')
      expect(result.headers).toBeUndefined()
    },
  )

  it('writes the reason for a cancelled lesson with the tutor or agency name (NTF-04)', async () => {
    const input = cases.find((item) => item.event === 'class_cancellation')!.input
    const result = await renderEmail('class_cancellation', input as never, logoUrl)
    expect(result.text).toContain('because Bright Minds teaches you on Kanvise.')
  })

  it.each(['live_class_reminder', 'assignment_deadline', 'submission_graded', 'mock_published', 'mock_fully_graded'] as const)(
    'switchable %s has an Unsubscribe link and one-click headers',
    async (event) => {
      const input = cases.find((item) => item.event === event)!.input
      const result = await renderEmail(event, input as never, logoUrl, { unsubscribe })
      expect(result.html).toContain('https://kanvise.com/unsubscribe?token=tok')
      expect(result.text).toContain('Unsubscribe')
      expect(result.text).not.toContain("You're getting this because")
      expect(result.headers).toEqual({
        'List-Unsubscribe': '<https://api.kanvise.com/unsubscribe/one-click?token=tok>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      })
    },
  )

  it('refuses to render a switchable email without an unsubscribe link', async () => {
    const input = cases.find((item) => item.event === 'live_class_reminder')!.input
    await expect(renderEmail('live_class_reminder', input as never, logoUrl)).rejects.toThrow('needs an unsubscribe link')
  })

  it('falls back to the page link in List-Unsubscribe when the API URL is unknown', async () => {
    const input = cases.find((item) => item.event === 'live_class_reminder')!.input
    const result = await renderEmail('live_class_reminder', input as never, logoUrl, { unsubscribe: { ...unsubscribe, oneClickUrl: null } })
    expect(result.headers).toEqual({ 'List-Unsubscribe': '<https://kanvise.com/unsubscribe?token=tok>' })
  })

  it('writes times in the account timezone with the zone named (NTF-04)', async () => {
    const input = cases.find((item) => item.event === 'live_class_reminder')!.input
    const lagos = await renderEmail('live_class_reminder', input as never, logoUrl, { unsubscribe })
    expect(lagos.text).toContain('Mon 20 Jul, 4:00 PM WAT')
    const nairobi = await renderEmail('live_class_reminder', input as never, logoUrl, { unsubscribe, timeZone: 'Africa/Nairobi' })
    expect(nairobi.text).toContain('Mon 20 Jul, 6:00 PM EAT')
  })
})

import { describe, expect, it } from 'vitest'
import { emailSubjects } from '../emails/subjects'
import { emailClassification, notificationChannelRows, notificationRows } from './rows'
import { notificationEmailEvents } from './types'

describe('notification rows catalogue', () => {
  it('lists every CFG-N row with its spec default', () => {
    const cfgN = Object.values(notificationRows).filter((row) => row.screen === 'CFG-N')
    expect(cfgN.map((row) => [row.title, row.defaults.push, row.defaults.email])).toEqual([
      ['Lesson reminder before my lesson', true, true],
      ['A student is waiting for my lesson', true, false],
      ["My lesson hasn't started on time", true, true],
      ['A student sent a message about a lesson', true, false],
      ['Homework handed in', true, false],
      ['Quiz finished', true, false],
      ['Starting check finished', true, true],
      ['Summary still to write (after 24 h)', true, true],
      ["Kavi's draft is ready", true, false],
      ['Courses given to me', true, true],
      ['Daily summary for admins', false, true],
    ])
  })

  it('has the two SA-10 student switches', () => {
    expect(Object.values(notificationRows).filter((row) => row.screen === 'SA-10').map((row) => row.title)).toEqual(['Push', 'Email reminders'])
  })

  it('classifies every email template that exists', () => {
    expect(Object.keys(emailClassification).sort()).toEqual(Object.keys(emailSubjects).sort())
  })

  it('switchable emails point at rows that have an email and a label', () => {
    for (const classification of Object.values(emailClassification)) {
      if (classification.kind !== 'switchable') continue
      const row = notificationRows[classification.row]
      expect(row.channels).toContain('email')
      expect(row.emailLabel).toBeTruthy()
    }
  })

  it('a notification event and its email template agree on the email row', () => {
    for (const [event, rules] of Object.entries(notificationChannelRows)) {
      const template = notificationEmailEvents[event as keyof typeof notificationEmailEvents]
      if (!template) continue
      const classification = emailClassification[template]
      expect(rules.email, event).toBe(classification.kind === 'always' ? 'always' : classification.row)
    }
  })

  it('gives the unsubscribe page its sentence', () => {
    expect(`You won't get ${notificationRows.lesson_reminders.emailLabel} emails any more.`).toBe("You won't get lesson reminder emails any more.")
  })
})

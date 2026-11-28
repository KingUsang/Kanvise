import { describe, expect, it } from 'vitest'
import {
  canAccessDashboardPath,
  deniedReason,
  getBottomBarArea,
  getBottomBarTabs,
  getDashboardNavGroups,
  getDashboardNavItems,
  getDashboardPageTitle,
  type DashboardCapabilities,
} from './dashboard-navigation'

const agencyAdmin: DashboardCapabilities = { isAdmin: true, isTutor: false, organisationType: 'centre' }
const agencyAdminTutor: DashboardCapabilities = { isAdmin: true, isTutor: true, organisationType: 'centre' }
const agencyTutor: DashboardCapabilities = { isAdmin: false, isTutor: true, organisationType: 'centre' }
const independentTutor: DashboardCapabilities = { isAdmin: true, isTutor: true, organisationType: 'independent' }
const setupRequired: DashboardCapabilities = { isAdmin: true, isTutor: false, setupRequired: true }

function groups(capabilities: DashboardCapabilities) {
  return getDashboardNavGroups(capabilities).map((group) => [group.label, group.items.map((item) => item.label)])
}

// Screens from later build steps are hidden, not disabled (HANDOFF "Build order").
const laterStepRoutes = ['/setup', '/lessons', '/team', '/recordings', '/profile', '/calendar', '/courses', '/students', '/homework', '/quizzes', '/resources', '/settings', '/tutors', '/dashboard/more']

describe('dashboard navigation groups (SH-02)', () => {
  it('gives an agency admin who teaches every group', () => {
    expect(groups(agencyAdminTutor)).toEqual([
      [null, ['Dashboard', 'Calendar', 'Timetable', 'Courses']],
      ['People', ['Students', 'Tutors']],
      ['Work', ['Homework', 'Quizzes', 'Question banks']],
      ['Library', ['Resources']],
      ['Account', ['Settings', 'Payments']],
    ])
  })

  it('leaves out groups with nothing visible for an admin who does not teach', () => {
    expect(groups(agencyAdmin)).toEqual([
      [null, ['Dashboard', 'Calendar', 'Timetable', 'Courses']],
      ['People', ['Students', 'Tutors']],
      ['Work', ['Quizzes', 'Question banks']],
      ['Account', ['Settings', 'Payments']],
    ])
  })

  it('keeps today\'s tutor access: no People or Account group for an agency tutor', () => {
    expect(groups(agencyTutor)).toEqual([
      [null, ['Dashboard', 'Calendar', 'Courses']],
      ['Work', ['Homework', 'Quizzes', 'Question banks']],
      ['Library', ['Resources']],
    ])
  })

  it('hides agency-only pages from independent tutors', () => {
    expect(groups(independentTutor)).toEqual([
      [null, ['Dashboard', 'Calendar', 'Courses']],
      ['People', ['Students']],
      ['Work', ['Homework', 'Quizzes', 'Question banks']],
      ['Library', ['Resources']],
      ['Account', ['Settings', 'Payments']],
    ])
    expect(canAccessDashboardPath('/dashboard/tutors', independentTutor)).toBe(false)
    expect(canAccessDashboardPath('/dashboard/timetable', independentTutor)).toBe(false)
  })

  it('shows only the setup item until a new agency exists', () => {
    expect(getDashboardNavItems(setupRequired).map((item) => [item.label, item.href])).toEqual([['Set up tutoring agency', '/dashboard/school-setup']])
    expect(canAccessDashboardPath('/dashboard', setupRequired)).toBe(false)
    expect(canAccessDashboardPath('/dashboard/school-setup', setupRequired)).toBe(true)
  })

  it('never links to a screen from a later build step', () => {
    for (const capabilities of [agencyAdmin, agencyAdminTutor, agencyTutor, independentTutor, setupRequired]) {
      const hrefs = [
        ...getDashboardNavItems(capabilities).map((item) => item.href),
        ...getBottomBarTabs(capabilities).flatMap((tab) => (tab.href ? [tab.href] : [])),
      ]
      for (const route of laterStepRoutes) expect(hrefs).not.toContain(route)
      expect(hrefs.every((href) => href === '/dashboard' || href.startsWith('/dashboard/'))).toBe(true)
      const labels = getDashboardNavItems(capabilities).map((item) => item.label)
      for (const hidden of ['Setup', 'Lessons', 'Team', 'Recordings']) expect(labels).not.toContain(hidden)
    }
  })

  it('puts Setup above Dashboard for the account owner while the checklist has rows to do (SH-02)', () => {
    const owner: DashboardCapabilities = { ...independentTutor, setupVisible: true }
    expect(getDashboardNavItems(owner).slice(0, 2).map((item) => [item.label, item.href])).toEqual([['Setup', '/dashboard/setup'], ['Dashboard', '/dashboard']])
    expect(getDashboardNavGroups(owner)[0].items[0].label).toBe('Setup')
    expect(getDashboardNavItems(independentTutor).map((item) => item.label)).not.toContain('Setup')
    // A tutor has no checklist even if the flag leaked through.
    expect(getDashboardNavItems({ ...agencyTutor, setupVisible: true }).map((item) => item.label)).not.toContain('Setup')
    expect(canAccessDashboardPath('/dashboard/setup', owner)).toBe(true)
    expect(canAccessDashboardPath('/dashboard/setup', agencyTutor)).toBe(false)
  })

  it('uses the redesign words', () => {
    const labels = getDashboardNavItems(agencyAdminTutor).map((item) => item.label).join(' ')
    expect(labels).not.toMatch(/Learner|Class|Session|Assignment|Material/)
  })
})

describe('phone bottom bar (R-02)', () => {
  it('shows Today, Calendar, Students and More to an agency admin', () => {
    expect(getBottomBarTabs(agencyAdmin).map((tab) => tab.label)).toEqual(['Today', 'Calendar', 'Students', 'More'])
  })

  it('shows Today, Calendar and More to an agency tutor', () => {
    expect(getBottomBarTabs(agencyTutor).map((tab) => tab.label)).toEqual(['Today', 'Calendar', 'More'])
  })

  it('never shows Lessons, Setup, Team or Recordings', () => {
    for (const capabilities of [agencyAdmin, agencyTutor, independentTutor]) {
      const labels = getBottomBarTabs(capabilities).map((tab) => tab.label)
      for (const hidden of ['Lessons', 'Setup', 'Team', 'Recordings']) expect(labels).not.toContain(hidden)
    }
  })

  it('maps pages to their tab, everything else to More', () => {
    expect(getBottomBarArea('/dashboard')).toBe('today')
    expect(getBottomBarArea('/dashboard/schedule/abc')).toBe('calendar')
    expect(getBottomBarArea('/dashboard/students')).toBe('students')
    expect(getBottomBarArea('/dashboard/mocks')).toBe('more')
  })

  it('titles the dashboard Today on phones', () => {
    expect(getDashboardPageTitle('/dashboard')).toBe('Today')
    expect(getDashboardPageTitle('/dashboard/assignments/1/submissions')).toBe('Homework')
    expect(getDashboardPageTitle('/dashboard/question-banks')).toBe('Question banks')
  })
})

describe('route access keeps today\'s rules', () => {
  it('lets tutors and admins open their profile', () => {
    expect(canAccessDashboardPath('/dashboard/profile', agencyTutor)).toBe(true)
    expect(canAccessDashboardPath('/dashboard/profile', agencyAdmin)).toBe(true)
    expect(canAccessDashboardPath('/dashboard/profile', { isAdmin: false, isTutor: false })).toBe(false)
  })

  it('refuses admin pages to tutors and names the reason', () => {
    expect(canAccessDashboardPath('/dashboard/tutors', agencyTutor)).toBe(false)
    expect(canAccessDashboardPath('/dashboard/students', agencyTutor)).toBe(false)
    expect(deniedReason('/dashboard/tutors', agencyTutor)).toBe('admin')
    expect(deniedReason('/dashboard/tutors', independentTutor)).toBe('unavailable')
    expect(deniedReason('/dashboard/assignments', agencyAdmin)).toBe('unavailable')
  })

  it('keeps question banks shared and unknown pages open to the shell', () => {
    expect(canAccessDashboardPath('/dashboard/question-banks', agencyTutor)).toBe(true)
    expect(canAccessDashboardPath('/dashboard/attendance', agencyTutor)).toBe(true)
  })
})

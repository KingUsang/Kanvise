import { describe, expect, it } from 'vitest'
import { canAccessDashboardPath, getDashboardNavItems, getDashboardWorkspaceForPath, getDashboardWorkspaces } from './dashboard-navigation'

describe('dashboard workspaces', () => {
  it('gives an admin-tutor the mobile work areas that matter while teaching', () => {
    expect(getDashboardWorkspaces({ isAdmin: true, isTutor: true }).map(item => item.label))
      .toEqual(['Home', 'Classes', 'Mocks', 'Calendar', 'More'])
  })

  it('only shows areas the current role can use', () => {
    expect(getDashboardWorkspaces({ isAdmin: false, isTutor: true }).map(item => item.label))
      .toEqual(['Home', 'Classes', 'Mocks', 'Calendar'])
    expect(getDashboardWorkspaces({ isAdmin: true, isTutor: false }).map(item => item.label))
      .toEqual(['Home', 'Classes', 'Mocks', 'Calendar', 'More'])
  })

  it('shows only the truthful setup destination until a new centre exists', () => {
    expect(getDashboardWorkspaces({ isAdmin: true, isTutor: false, setupRequired: true }))
      .toEqual([expect.objectContaining({ label: 'Set up centre', href: '/dashboard/school-setup', area: 'centre' })])
  })

  it('keeps secondary pages inside their parent workspace', () => {
    expect(getDashboardWorkspaceForPath('/dashboard/question-banks')).toBe('mocks')
    expect(getDashboardWorkspaceForPath('/dashboard/assignments/example/submissions')).toBe('mocks')
    expect(getDashboardWorkspaceForPath('/dashboard/students')).toBe('centre')
  })

  it('keeps tutor management exclusive to agency administrators', () => {
    expect(getDashboardNavItems({ isAdmin: true, isTutor: false }).some(item => item.href === '/dashboard/tutors')).toBe(true)
    const independentTutor = { isAdmin: false, isTutor: true, organisationType: 'independent' as const }
    const independentAdminTutor = { isAdmin: true, isTutor: true, organisationType: 'independent' as const }
    expect(getDashboardNavItems(independentTutor).some(item => item.href === '/dashboard/tutors')).toBe(false)
    expect(getDashboardNavItems(independentAdminTutor).some(item => item.href === '/dashboard/tutors')).toBe(false)
    expect(canAccessDashboardPath('/dashboard/tutors', independentTutor)).toBe(false)
    expect(canAccessDashboardPath('/dashboard/tutors', independentAdminTutor)).toBe(false)
  })

  it('makes the shared profile available to tutors and administrators', () => {
    expect(canAccessDashboardPath('/dashboard/profile', { isAdmin: false, isTutor: true })).toBe(true)
    expect(canAccessDashboardPath('/dashboard/profile', { isAdmin: true, isTutor: false })).toBe(true)
    expect(canAccessDashboardPath('/dashboard/profile', { isAdmin: false, isTutor: false })).toBe(false)
  })
})

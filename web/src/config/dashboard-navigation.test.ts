import { describe, expect, it } from 'vitest'
import { getDashboardWorkspaceForPath, getDashboardWorkspaces } from './dashboard-navigation'

describe('dashboard workspaces', () => {
  it('gives an admin-tutor all five recurring work areas', () => {
    expect(getDashboardWorkspaces({ isAdmin: true, isTutor: true }).map(item => item.label))
      .toEqual(['Home', 'Classes', 'Teaching', 'Mocks', 'Centre'])
  })

  it('only shows areas the current role can use', () => {
    expect(getDashboardWorkspaces({ isAdmin: false, isTutor: true }).map(item => item.label))
      .toEqual(['Home', 'Classes', 'Teaching', 'Mocks'])
    expect(getDashboardWorkspaces({ isAdmin: true, isTutor: false }).map(item => item.label))
      .toEqual(['Home', 'Classes', 'Mocks', 'Centre'])
  })

  it('keeps secondary pages inside their parent workspace', () => {
    expect(getDashboardWorkspaceForPath('/dashboard/attendance')).toBe('classes')
    expect(getDashboardWorkspaceForPath('/dashboard/question-banks')).toBe('mocks')
    expect(getDashboardWorkspaceForPath('/dashboard/assignments/example/submissions')).toBe('teaching')
    expect(getDashboardWorkspaceForPath('/dashboard/students')).toBe('centre')
  })
})

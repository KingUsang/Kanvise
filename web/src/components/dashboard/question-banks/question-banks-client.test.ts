import { describe, expect, it } from 'vitest'
import { buildQuestionContent, buildQuestionOptions } from './question-banks-client'
import { canAccessDashboardPath, getDashboardAccess, getDashboardNavItems } from '@/config/dashboard-navigation'

describe('question-bank authoring helpers', () => {
  it('keeps the correct answer attached to its original option when blank rows are removed', () => {
    expect(buildQuestionOptions(['', 'Mercury', 'Venus', ''], 1)).toEqual([
      {
        plain_text: 'Mercury',
        content_blocks: [{ type: 'text', text: 'Mercury' }],
        is_correct: true,
      },
      {
        plain_text: 'Venus',
        content_blocks: [{ type: 'text', text: 'Venus' }],
        is_correct: false,
      },
    ])
  })

  it('builds normalized equation and chemistry blocks', () => {
    expect(buildQuestionContent(' Solve this ', 'equation', ' x^2 = 4 ')).toEqual([
      { type: 'text', text: 'Solve this' },
      { type: 'equation', latex: 'x^2 = 4' },
    ])
    expect(buildQuestionContent('Balance', 'chemistry', String.raw`\ce{H2 + O2 -> H2O}`)[1]).toEqual({
      type: 'chemistry', latex: String.raw`\ce{H2 + O2 -> H2O}`,
    })
    expect(buildQuestionContent('', 'none', '')).toEqual([])
  })

  it('shows question banks to admins, tutors, and combined admin-tutors', () => {
    expect(getDashboardNavItems({ isAdmin: true, isTutor: false }).some(item => item.href === '/dashboard/question-banks')).toBe(true)
    expect(getDashboardNavItems({ isAdmin: false, isTutor: true }).some(item => item.href === '/dashboard/question-banks')).toBe(true)
    expect(getDashboardNavItems({ isAdmin: true, isTutor: true }).some(item => item.href === '/dashboard/question-banks')).toBe(true)
  })

  it('classifies nested dashboard routes using their parent page privileges', () => {
    expect(getDashboardAccess('/dashboard/payments')).toBe('admin')
    expect(getDashboardAccess('/dashboard/mocks/mock-1/results')).toBe('shared')
    expect(getDashboardAccess('/dashboard/assignments/assignment-1/submissions')).toBe('tutor')
    expect(canAccessDashboardPath('/dashboard/payments', { isAdmin: false, isTutor: true })).toBe(false)
    expect(canAccessDashboardPath('/dashboard/notes', { isAdmin: true, isTutor: false })).toBe(false)
    expect(canAccessDashboardPath('/dashboard/notes', { isAdmin: true, isTutor: true })).toBe(true)
  })

  it('keeps a new Admin inside school setup until a centre is created', () => {
    const onboarding = { isAdmin: true, isTutor: false, setupRequired: true }
    expect(getDashboardNavItems(onboarding).map(item => item.href)).toEqual(['/dashboard/school-setup'])
    expect(canAccessDashboardPath('/dashboard/school-setup', onboarding)).toBe(true)
    expect(canAccessDashboardPath('/dashboard/programmes', onboarding)).toBe(false)
  })
})

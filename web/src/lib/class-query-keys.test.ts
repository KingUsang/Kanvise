import { describe, expect, it } from 'vitest'
import { classQueryKeys } from './class-query-keys'

describe('class query keys', () => {
  it('isolates every account-scoped Class surface', () => {
    expect(classQueryKeys.workspace('account-a', 'class-1')).not.toEqual(classQueryKeys.workspace('account-b', 'class-1'))
    expect(classQueryKeys.materials('account-a', 'class-1', 'all')).not.toEqual(classQueryKeys.materials('account-b', 'class-1', 'all'))
    expect(classQueryKeys.dashboardSchedule('account-a')).not.toEqual(classQueryKeys.dashboardSchedule('account-b'))
  })

  it('keeps invalidation factories identical to their query keys', () => {
    const accountId = 'account-a'
    expect(classQueryKeys.programmes(accountId)).toEqual(['programmes', accountId])
    expect(classQueryKeys.learnerDetail(accountId, 'class-1', 'subject-1', 'learner-1')).toEqual([
      'class-learner-detail', accountId, 'class-1', 'subject-1', 'learner-1',
    ])
  })
})

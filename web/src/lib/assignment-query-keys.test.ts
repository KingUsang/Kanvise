import { describe, expect, it } from 'vitest'
import { assignmentQueryKeys } from './assignment-query-keys'

describe('Assignment query keys', () => {
  it('isolates Assignment lists by active account', () => {
    expect(assignmentQueryKeys.list('11111111-1111-4111-8111-111111111111', null, null))
      .not.toEqual(assignmentQueryKeys.list('22222222-2222-4222-8222-222222222222', null, null))
  })

  it('isolates submission review caches by active account', () => {
    expect(assignmentQueryKeys.submissions('11111111-1111-4111-8111-111111111111', 'assignment-1'))
      .not.toEqual(assignmentQueryKeys.submissions('22222222-2222-4222-8222-222222222222', 'assignment-1'))
  })
})

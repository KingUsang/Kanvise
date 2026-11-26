import { describe, expect, it } from 'vitest'
import { peopleQueryKeys } from './people-query-keys'

describe('people management query keys', () => {
  it('isolates every panel by the reactive active account', () => {
    expect(peopleQueryKeys('account-a').tutors).not.toEqual(peopleQueryKeys('account-b').tutors)
    expect(peopleQueryKeys('account-a').assignments).not.toEqual(peopleQueryKeys('account-b').assignments)
  })
})

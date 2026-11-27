import { describe, expect, it } from 'vitest'
import { settingsQueryKeys } from './settings-query-keys'

describe('Settings query keys', () => {
  it('isolates tutoring account settings by active account', () => {
    expect(settingsQueryKeys.school('account-a')).not.toEqual(settingsQueryKeys.school('account-b'))
  })
})

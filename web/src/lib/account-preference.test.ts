import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearActiveAccountId, getActiveAccountId, setActiveAccountId } from './account-preference'

const accountOne = '11111111-1111-4111-8111-111111111111'

describe('active account preference', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores only the current tab preference and emits a local change event', () => {
    const listener = vi.fn()
    window.addEventListener('kanvise:active-account-changed', listener)

    setActiveAccountId(accountOne)

    expect(sessionStorage.length).toBe(1)
    expect(getActiveAccountId()).toBe(accountOne)
    expect(localStorage.getItem('kanvise:active-account:v1')).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('kanvise:active-account-changed', listener)
  })

  it('ignores invalid persisted identifiers and clears the preference', () => {
    sessionStorage.setItem('kanvise:active-account:v1', 'not-an-account')

    expect(getActiveAccountId()).toBeNull()
    clearActiveAccountId()
    expect(sessionStorage.getItem('kanvise:active-account:v1')).toBeNull()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  accountContextHeaders,
  clearActiveAccountId,
  getActiveAccountId,
  readAccountCookie,
  setActiveAccountId,
  subscribeToActiveAccount,
} from './account-preference'

const accountOne = '11111111-1111-4111-8111-111111111111'
const accountTwo = '22222222-2222-4222-8222-222222222222'

function captureCookieWrites() {
  const writes: string[] = []
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
  vi.spyOn(document, 'cookie', 'set').mockImplementation(value => {
    writes.push(value)
    descriptor.set!.call(document, value)
  })
  return writes
}

describe('active account preference', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearActiveAccountId()
    sessionStorage.clear()
  })

  it('writes a first-party Lax cookie on selection and emits a local change event', () => {
    const writes = captureCookieWrites()
    const listener = vi.fn()
    window.addEventListener('kanvise:active-account-changed', listener)

    setActiveAccountId(accountOne)

    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatch(new RegExp(`^kanvise_account=${accountOne}; Path=/; Max-Age=15552000; SameSite=Lax$`))
    expect(document.cookie).toContain(`kanvise_account=${accountOne}`)
    expect(getActiveAccountId()).toBe(accountOne)
    expect(accountContextHeaders()).toEqual({ 'X-Kanvise-Account-Id': accountOne })
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('kanvise:active-account-changed', listener)
  })

  it('marks the cookie Secure when the page is served over https', () => {
    const writes = captureCookieWrites()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, protocol: 'https:' } as Location)

    setActiveAccountId(accountOne)

    expect(writes[0]).toMatch(/; SameSite=Lax; Secure$/)
  })

  it('expires the cookie and removes the legacy tab value on clear', () => {
    setActiveAccountId(accountOne)
    sessionStorage.setItem('kanvise:active-account:v1', accountTwo)
    const writes = captureCookieWrites()

    clearActiveAccountId()

    expect(writes[0]).toMatch(/^kanvise_account=; Path=\/; Max-Age=0; SameSite=Lax/)
    expect(document.cookie).not.toContain('kanvise_account=')
    expect(sessionStorage.getItem('kanvise:active-account:v1')).toBeNull()
    expect(getActiveAccountId()).toBeNull()
    expect(accountContextHeaders()).toEqual({})
  })

  it('falls back to the legacy session value until a cookie exists, and ignores invalid values', () => {
    sessionStorage.setItem('kanvise:active-account:v1', 'not-an-account')
    expect(getActiveAccountId()).toBeNull()

    sessionStorage.setItem('kanvise:active-account:v1', accountTwo)
    expect(getActiveAccountId()).toBe(accountTwo)

    setActiveAccountId(accountOne)
    expect(getActiveAccountId()).toBe(accountOne)
    expect(sessionStorage.getItem('kanvise:active-account:v1')).toBeNull()
  })

  it('parses only a valid account id from a cookie header', () => {
    expect(readAccountCookie(`a=b; kanvise_account=${accountOne}; c=d`)).toBe(accountOne)
    expect(readAccountCookie('kanvise_account=not-a-uuid')).toBeNull()
    expect(readAccountCookie('other=1')).toBeNull()
    expect(readAccountCookie(null)).toBeNull()
  })

  it('notifies subscribers when the active account changes so query keys can reload', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToActiveAccount(listener)

    setActiveAccountId(accountOne)

    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })
})

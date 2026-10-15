import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BROWSER_PUSH_ELIGIBLE_EVENT, BROWSER_PUSH_ELIGIBLE_KEY, isBrowserPushEligible, recordBrowserPushEngagement } from './browser-push-eligibility'

describe('browser push eligibility', () => {
  beforeEach(() => localStorage.clear())

  it('waits for three interactions before making a reminder prompt eligible', () => {
    const event = vi.fn()
    window.addEventListener(BROWSER_PUSH_ELIGIBLE_EVENT, event)
    recordBrowserPushEngagement()
    recordBrowserPushEngagement()
    expect(isBrowserPushEligible()).toBe(false)
    recordBrowserPushEngagement()
    expect(localStorage.getItem(BROWSER_PUSH_ELIGIBLE_KEY)).toBe('true')
    expect(event).toHaveBeenCalledOnce()
    window.removeEventListener(BROWSER_PUSH_ELIGIBLE_EVENT, event)
  })

  it('does not keep counting once the browser is eligible', () => {
    localStorage.setItem(BROWSER_PUSH_ELIGIBLE_KEY, 'true')
    recordBrowserPushEngagement()
    expect(localStorage.getItem('kanvise-browser-push-interactions')).toBeNull()
  })
})

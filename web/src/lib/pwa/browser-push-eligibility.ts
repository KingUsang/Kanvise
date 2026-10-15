export const BROWSER_PUSH_ELIGIBLE_EVENT = 'kanvise-browser-push-eligible'
export const BROWSER_PUSH_ELIGIBLE_KEY = 'kanvise-browser-push-eligible'
const BROWSER_PUSH_INTERACTIONS_KEY = 'kanvise-browser-push-interactions'
const REQUIRED_INTERACTIONS = 3

/** Offers reminders only after the learner has actively explored Kanvise. */
export function recordBrowserPushEngagement() {
  try {
    if (isBrowserPushEligible()) return
    const interactions = Number(localStorage.getItem(BROWSER_PUSH_INTERACTIONS_KEY) || 0) + 1
    localStorage.setItem(BROWSER_PUSH_INTERACTIONS_KEY, String(interactions))
    if (interactions < REQUIRED_INTERACTIONS) return
    localStorage.setItem(BROWSER_PUSH_ELIGIBLE_KEY, 'true')
    window.dispatchEvent(new Event(BROWSER_PUSH_ELIGIBLE_EVENT))
  } catch {
    // Storage restrictions must never interfere with learning.
  }
}

export function isBrowserPushEligible() {
  try {
    return localStorage.getItem(BROWSER_PUSH_ELIGIBLE_KEY) === 'true'
  } catch {
    return false
  }
}

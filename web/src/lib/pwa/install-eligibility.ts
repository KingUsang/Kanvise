export const INSTALL_ELIGIBLE_KEY = 'kanvise-install-eligible'
export const INSTALL_ELIGIBLE_EVENT = 'kanvise-install-eligible'

const INSTALL_INTERACTIONS_KEY = 'kanvise-install-interactions'
const REQUIRED_INTERACTIONS = 6

/** Marks this browser as eligible only after a meaningful Kanvise action. */
export function markInstallEligible() {
  try {
    localStorage.setItem(INSTALL_ELIGIBLE_KEY, 'true')
    window.dispatchEvent(new Event(INSTALL_ELIGIBLE_EVENT))
  } catch {
    // Storage restrictions must never affect class use.
  }
}

export function isInstallEligible() {
  try {
    return localStorage.getItem(INSTALL_ELIGIBLE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Counts deliberate clicks and marks the browser install-eligible after enough real use. */
export function recordInstallEngagement() {
  try {
    if (isInstallEligible()) return
    const interactions = Number(localStorage.getItem(INSTALL_INTERACTIONS_KEY) || 0) + 1
    localStorage.setItem(INSTALL_INTERACTIONS_KEY, String(interactions))
    if (interactions >= REQUIRED_INTERACTIONS) markInstallEligible()
  } catch {
    // Storage restrictions must never affect class use.
  }
}

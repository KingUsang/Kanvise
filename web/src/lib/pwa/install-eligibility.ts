export const INSTALL_ELIGIBLE_KEY = 'kanvise-install-eligible'
export const INSTALL_ELIGIBLE_EVENT = 'kanvise-install-eligible'

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

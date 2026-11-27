export const PROMPT_VISIBILITY_EVENT = 'kanvise-prompt-visibility'
let browserPushPromptVisible = false

/** The browser-push prompt has priority; the install prompt waits until it is closed. */
export function setBrowserPushPromptVisible(visible: boolean) {
  browserPushPromptVisible = visible
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROMPT_VISIBILITY_EVENT))
}

export function isBrowserPushPromptVisible() {
  return browserPushPromptVisible
}

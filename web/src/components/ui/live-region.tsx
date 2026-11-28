/**
 * Polite live region (SH-12). Render it once and change `message`; screen
 * readers announce each new value. Keep messages for changes that matter
 * ("5 results", "Saved"), never every keystroke.
 */
export function LiveRegion({ message, visuallyHidden = true }: { message: string; visuallyHidden?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={visuallyHidden ? 'sr-only' : undefined}>
      {message}
    </div>
  )
}

/** First focusable element on every page: jumps to the main content (SH-12). */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: { href?: string; children?: string }) {
  return (
    <a
      href={href}
      className="sr-only z-[100000] rounded-dashboard-control bg-dashboard-surface px-4 py-3 text-dashboard-small font-semibold text-dashboard-primary shadow-dashboard-overlay focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      {children}
    </a>
  )
}

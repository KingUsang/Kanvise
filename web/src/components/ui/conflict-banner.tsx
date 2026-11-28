'use client'

import { useId } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './button'

function Version({ label, text }: { label: string; text: string }) {
  const labelId = useId()
  return (
    <div className="min-w-0 space-y-1.5">
      <p id={labelId} className="text-dashboard-secondary font-semibold text-dashboard-foreground">{label}</p>
      <div
        role="region"
        aria-labelledby={labelId}
        // Long text scrolls inside the box; keyboard users can focus it to scroll.
        tabIndex={0}
        className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface p-3 text-dashboard-small text-dashboard-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus"
      >
        {text.trim() ? text : <span className="italic text-dashboard-muted">Nothing written.</span>}
      </div>
    </div>
  )
}

/**
 * Shown above a field when the same text changed on the server while this
 * device was offline (SH-13). The upload waits until the person chooses.
 */
export function ConflictBanner({ mine, theirs, onKeepMine, onUseNewer, className = '' }: {
  mine: string
  theirs: string
  onKeepMine: () => void
  onUseNewer: () => void
  className?: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={`animate-dashboard-menu-in space-y-4 rounded-dashboard-panel border border-dashboard-warning/40 bg-dashboard-warning-surface p-4 ${className}`.trim()}
    >
      <p id={titleId} className="flex items-start gap-2 text-dashboard-small font-semibold text-dashboard-foreground">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-dashboard-warning" />
        This changed while you were offline.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Version label="Your version" text={mine} />
        <Version label="The newer version" text={theirs} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onKeepMine} fullWidthMobile>Keep mine</Button>
        <Button variant="outline" onClick={onUseNewer} fullWidthMobile>Use the newer version</Button>
      </div>
    </section>
  )
}

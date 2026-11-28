'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { shouldSkipMotion } from '@/lib/skip-motion'

/** ONB-01: a line takes at most one second to appear, however long it is. */
export const KAVI_TYPING_MS = 400
export const KAVI_MAX_REVEAL_MS = 1000
const TICK_MS = 30

export function KaviMark({ wave = false }: { wave?: boolean }) {
  // The wave plays once on the hello screen; reduced motion and data saving skip it.
  const [waving] = useState(() => wave && !shouldSkipMotion())
  return (
    <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-dashboard-primary text-white ${waving ? 'animate-dashboard-wave origin-bottom' : ''}`}>
      <Sparkles className="size-5" />
    </span>
  )
}

type Phase = 'typing' | 'revealing' | 'shown'

/**
 * One scripted line from Kavi (02 ONB-01). It shows three dots for 0.4s, then
 * the text appears as if typed. With reduced motion or data saving on, the
 * line appears at once with no dots. Pressing any key shows the rest. Screen
 * readers hear the line once, when it is complete; the dots and the partial
 * text are hidden from them (01 SH-12).
 */
export function KaviLine({ text, animate = true, onShown }: { text: string; animate?: boolean; onShown?: () => void }) {
  // Lines render after the page has loaded in the browser, so the preference can be read up front.
  const [instant] = useState(() => !animate || shouldSkipMotion())
  const [phase, setPhase] = useState<Phase>(instant ? 'shown' : 'typing')
  const [chars, setChars] = useState(0)
  const onShownRef = useRef(onShown)

  useEffect(() => {
    onShownRef.current = onShown
  })

  useEffect(() => {
    if (phase !== 'typing') return
    const timer = window.setTimeout(() => setPhase('revealing'), KAVI_TYPING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'revealing') return
    const perTick = Math.max(1, Math.ceil(text.length / (KAVI_MAX_REVEAL_MS / TICK_MS)))
    const timer = window.setInterval(() => {
      setChars((value) => {
        const next = value + perTick
        if (next >= text.length) {
          window.clearInterval(timer)
          setPhase('shown')
          return text.length
        }
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [phase, text])

  useEffect(() => {
    if (phase !== 'typing' && phase !== 'revealing') return
    const finish = () => setPhase('shown')
    window.addEventListener('keydown', finish)
    return () => window.removeEventListener('keydown', finish)
  }, [phase])

  useEffect(() => {
    if (phase === 'shown') onShownRef.current?.()
  }, [phase])

  if (phase === 'typing') {
    return (
      <div data-testid="kavi-typing" aria-hidden="true" className="flex min-h-9 items-center gap-1 px-1">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2 animate-bounce rounded-full bg-dashboard-muted" style={{ animationDelay: `${dot * 120}ms` }} />
        ))}
      </div>
    )
  }
  const shown = phase === 'shown'
  if (instant) return <p className="text-base leading-6 text-dashboard-foreground">{text}</p>
  return (
    <p aria-live="polite" className="text-base leading-6 text-dashboard-foreground">
      <span aria-hidden="true">{shown ? text : text.slice(0, chars)}</span>
      {shown ? <span className="sr-only">{text}</span> : null}
    </p>
  )
}

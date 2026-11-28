'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button, IconButton } from '@/components/dashboard/action-controls'

/**
 * Segmented wizard progress (SH-10): one segment per step, finished steps
 * filled, the current step in the location colour.
 */
export function WizardProgress({ steps, current, label = 'Progress' }: {
  steps: string[]
  /** Zero-based index of the current step. */
  current: number
  label?: string
}) {
  return (
    <ol aria-label={label} className="flex gap-1.5">
      {steps.map((step, index) => {
        const state = index < current ? 'complete' : index === current ? 'current' : 'upcoming'
        const color = state === 'complete' ? 'bg-dashboard-primary' : state === 'current' ? 'bg-dashboard-location' : 'bg-dashboard-outline-strong'
        return (
          <li key={step} data-state={state} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0 flex-1">
            <span aria-hidden="true" className={`dashboard-progress-fill block h-1.5 rounded-full ${color}`} />
            <span className="sr-only">
              Step {index + 1} of {steps.length}: {step}
              {state === 'complete' ? ', done' : state === 'current' ? ', current step' : ''}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * One wizard step. When the step changes (not on first render) focus moves to
 * its heading and the content slides in from the direction of travel.
 */
export function WizardStep({ stepKey, title, direction = 'forward', children }: {
  /** Changes whenever the step changes. */
  stepKey: string | number
  title: ReactNode
  direction?: 'forward' | 'back'
  children: ReactNode
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousKey = useRef(stepKey)
  useEffect(() => {
    if (previousKey.current === stepKey) return
    previousKey.current = stepKey
    headingRef.current?.focus()
  }, [stepKey])
  return (
    <div key={stepKey} data-direction={direction} className={direction === 'back' ? 'animate-dashboard-step-back' : 'animate-dashboard-step-forward'}>
      <h3 ref={headingRef} tabIndex={-1} className="text-dashboard-section-title font-semibold text-dashboard-foreground outline-none">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

/**
 * Wizard buttons: round back button bottom left from step 2, Continue bottom
 * right. On phones the bar is fixed above the keyboard by its container
 * (ModalDialog footer, or `sticky` here when used on a page).
 */
export function WizardNav({ current, onBack, onContinue, continueLabel = 'Continue', pending = false, sticky = false }: {
  current: number
  onBack: () => void
  onContinue: () => void
  continueLabel?: string
  pending?: boolean
  sticky?: boolean
}) {
  return (
    <div className={`flex w-full items-center justify-between gap-3 ${sticky ? 'max-md:sticky max-md:bottom-0 max-md:bg-dashboard-surface max-md:py-3' : ''}`}>
      {current > 0
        ? <IconButton variant="outline" label="Back" onClick={onBack} className="rounded-full" disabled={pending}><ArrowLeft aria-hidden="true" className="size-5" /></IconButton>
        : <span aria-hidden="true" />}
      <Button variant="primary" onClick={onContinue} pending={pending} className="max-md:flex-1">{continueLabel}</Button>
    </div>
  )
}

'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/dashboard/action-controls'
import { ModalDialog } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'

export const FEEDBACK_MAX_LENGTH = 4000

/**
 * Share feedback (SH-04b): one Message field. Send stays disabled until
 * something is typed. On failure the text is kept and an inline error shows.
 */
export function ShareFeedbackDialog({ open, onClose, onSend }: {
  open: boolean
  onClose: () => void
  onSend: (message: string) => Promise<void>
}) {
  const fieldId = useId()
  const errorId = useId()
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const hasText = message.trim().length > 0

  const close = () => {
    setState('idle')
    onClose()
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!hasText || state === 'sending') return
    setState('sending')
    try {
      await onSend(message.trim())
      setMessage('')
      setState('idle')
      onClose()
      toast.success('Thanks, we read every message.')
    } catch {
      setState('error')
    }
  }

  const formId = `${fieldId}-form`
  return (
    <ModalDialog
      open={open}
      onClose={close}
      busy={state === 'sending'}
      title="Share feedback"
      subtitle="Tell us what's working, what isn't, or what you'd like Kanvise to do next."
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={state === 'sending'}>Cancel</Button>
          <Button type="submit" form={formId} disabled={!hasText} pending={state === 'sending'} pendingLabel="Sending…">Send</Button>
        </>
      }
    >
      <form id={formId} onSubmit={send}>
        <label htmlFor={fieldId} className="block text-dashboard-small font-semibold text-dashboard-foreground">Message</label>
        <textarea
          id={fieldId}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={6}
          aria-invalid={state === 'error' || undefined}
          aria-describedby={state === 'error' ? errorId : undefined}
          data-autofocus=""
          className="mt-1.5 block min-h-36 w-full resize-y rounded-dashboard-control border border-dashboard-outline-strong bg-dashboard-surface px-3 py-2.5 text-base text-dashboard-foreground outline-none placeholder:text-dashboard-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus md:text-dashboard-small"
        />
        {state === 'error' ? (
          <p id={errorId} role="alert" className="mt-2 text-dashboard-small text-dashboard-danger">We couldn&apos;t send that. Try again in a moment.</p>
        ) : null}
      </form>
    </ModalDialog>
  )
}

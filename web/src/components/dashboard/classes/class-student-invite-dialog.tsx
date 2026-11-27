'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { Button } from '@/components/dashboard/action-controls'
import { Dialog } from '@/components/dashboard/dialog'
import { Field, fieldControlClassName, fieldDescribedBy } from '@/components/dashboard/form-fields'

type InviteField = 'email'
type InviteErrors = Partial<Record<InviteField, string>>

export function ClassStudentInviteDialog({
  open,
  onClose,
  classId,
  className,
  api,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  classId: string
  className: string
  api: string | undefined
  onInvited: () => Promise<void> | void
}) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<InviteErrors>({})

  useEffect(() => {
    if (!open) return
    setEmail('')
    setSending(false)
    setErrors({})
  }, [open])

  if (!open) return null

  const validate = () => {
    const nextErrors: InviteErrors = {}
    if (!email.trim()) nextErrors.email = 'Enter the learner’s email address.'
    setErrors(nextErrors)
    const firstError = (['email'] as const).find((field) => nextErrors[field])
    if (firstError) window.requestAnimationFrame(() => document.getElementById(`student-${firstError}`)?.focus())
    return Object.keys(nextErrors).length === 0
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return
    if (!api) return toast.error('Learner service is unavailable. Refresh and try again.')
    try {
      setSending(true)
      const response = await authenticatedApiFetch(`${api}/users/students/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: [{
            email: email.trim(),
            programme_id: classId,
          }],
          send_invitations: true,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.errors?.[0]?.errors?.[0] || body?.error || 'Could not add this learner')
      if (body?.data?.errors?.length) throw new Error(body.data.errors[0]?.errors?.[0] || 'Could not add this learner')
      await onInvited()
      toast.success('Invitation sent. The learner will join this class after accepting it.')
      onClose()
    } catch (error) {
      toast.error('Could not add learner', { description: error instanceof Error ? error.message : 'Try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Class learners"
      title="Add learner"
      description="They will receive an email to set up their account."
      busy={sending}
      titleId="add-student-title"
      descriptionId="add-student-description"
    >
      <form onSubmit={(event) => void submit(event)} noValidate className="mt-5">
        {Object.keys(errors).length ? <div role="alert" className="mb-4 rounded-dashboard-control border border-dashboard-danger/30 bg-dashboard-danger/5 px-4 py-3 text-sm text-dashboard-danger">Fix the highlighted fields before sending the invitation.</div> : null}
        <div className="mt-5">
          <Field id="student-email" label="Email address" required error={errors.email}>
            <input
              id="student-email"
              data-dialog-initial-focus
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={sending}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={fieldDescribedBy('student-email', undefined, errors.email)}
              className={fieldControlClassName}
            />
          </Field>
        </div>
        <div className="mt-4 rounded-dashboard-panel border border-dashboard-primary/15 bg-dashboard-primary/5 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-dashboard-muted">Add to Class</p>
          <p className="mt-1 font-bold text-dashboard-foreground">{className}</p>
        </div>
        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-dashboard-outline pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="quiet" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button type="submit" variant="primary" pending={sending} pendingLabel="Sending invitation…">
            <Mail aria-hidden="true" size={17} /> Send invitation
          </Button>
        </footer>
      </form>
    </Dialog>
  )
}

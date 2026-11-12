'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { Button } from '@/components/dashboard/action-controls'
import { Dialog } from '@/components/dashboard/dialog'
import { Field, fieldControlClassName, fieldDescribedBy } from '@/components/dashboard/form-fields'

type InviteField = 'firstName' | 'lastName' | 'email'
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<InviteErrors>({})

  useEffect(() => {
    if (!open) return
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setSending(false)
    setErrors({})
  }, [open])

  if (!open) return null

  const validate = () => {
    const nextErrors: InviteErrors = {}
    if (!firstName.trim()) nextErrors.firstName = 'Enter the student’s first name.'
    if (!lastName.trim()) nextErrors.lastName = 'Enter the student’s last name.'
    if (!email.trim()) nextErrors.email = 'Enter the student’s email address.'
    setErrors(nextErrors)
    const firstError = (['firstName', 'lastName', 'email'] as const).find((field) => nextErrors[field])
    if (firstError) window.requestAnimationFrame(() => document.getElementById(`student-${firstError}`)?.focus())
    return Object.keys(nextErrors).length === 0
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return
    if (!api) return toast.error('Student service is unavailable. Refresh and try again.')
    try {
      setSending(true)
      const response = await authenticatedApiFetch(`${api}/users/students/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: [{
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            programme_id: classId,
          }],
          send_invitations: true,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.errors?.[0]?.errors?.[0] || body?.error || 'Could not add this student')
      if (body?.data?.errors?.length) throw new Error(body.data.errors[0]?.errors?.[0] || 'Could not add this student')
      await onInvited()
      toast.success('Student added and invitation sent')
      onClose()
    } catch (error) {
      toast.error('Could not add student', { description: error instanceof Error ? error.message : 'Try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Class students"
      title="Add student"
      description="They will receive an email to set up their account."
      busy={sending}
      titleId="add-student-title"
      descriptionId="add-student-description"
    >
      <form onSubmit={(event) => void submit(event)} noValidate className="mt-5">
        {Object.keys(errors).length ? <div role="alert" className="mb-4 rounded-dashboard-control border border-dashboard-danger/30 bg-dashboard-danger/5 px-4 py-3 text-sm text-dashboard-danger">Fix the highlighted fields before sending the invitation.</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="student-firstName" label="First name" required error={errors.firstName}>
            <input
              id="student-firstName"
              data-dialog-initial-focus
              required
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={sending}
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={fieldDescribedBy('student-firstName', undefined, errors.firstName)}
              className={fieldControlClassName}
            />
          </Field>
          <Field id="student-lastName" label="Last name" required error={errors.lastName}>
            <input
              id="student-lastName"
              required
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={sending}
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={fieldDescribedBy('student-lastName', undefined, errors.lastName)}
              className={fieldControlClassName}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field id="student-email" label="Email address" required error={errors.email}>
            <input
              id="student-email"
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
        <div className="mt-4">
          <Field id="student-phone" label="Phone number" optional>
            <input
              id="student-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={sending}
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

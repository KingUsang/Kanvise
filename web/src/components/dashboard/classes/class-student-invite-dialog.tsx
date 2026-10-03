'use client'

import { useEffect, useState } from 'react'
import { Mail, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

export function ClassStudentInviteDialog({
  open,
  onClose,
  classId,
  className,
  api,
  token,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  classId: string
  className: string
  api: string | undefined
  token: string
  onInvited: () => Promise<void> | void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setSending(false)
  }, [open])

  if (!open) return null

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) return toast.error('Enter the student’s first and last name.')
    if (!email.trim()) return toast.error('Enter the student’s email address.')
    if (!api) return toast.error('Student service is unavailable. Refresh and try again.')
    try {
      setSending(true)
      const response = await fetch(`${api}/users/students/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#180d62]/25 p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-student-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) onClose() }}>
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">Class students</p><h2 id="add-student-title" className="mt-1 text-xl font-bold text-[#180d62]">Add student</h2><p className="mt-1 text-sm leading-6 text-dashboard-muted">They will receive an email to set up their account.</p></div><button type="button" onClick={onClose} disabled={sending} aria-label="Close" className="rounded-lg p-2 text-[#625e69] hover:bg-[#f1efff] disabled:opacity-50"><X size={20}/></button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-[#27242d]">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={sending} className="mt-2 w-full rounded-lg border border-dashboard-outline px-3 py-2.5 font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></label><label className="block text-sm font-bold text-[#27242d]">Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={sending} className="mt-2 w-full rounded-lg border border-dashboard-outline px-3 py-2.5 font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></label></div>
      <label className="mt-4 block text-sm font-bold text-[#27242d]">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={sending} className="mt-2 w-full rounded-lg border border-dashboard-outline px-3 py-2.5 font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></label><label className="mt-4 block text-sm font-bold text-[#27242d]">Phone number <span className="font-normal text-dashboard-muted">(optional)</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={sending} className="mt-2 w-full rounded-lg border border-dashboard-outline px-3 py-2.5 font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></label>
      <div className="mt-4 rounded-xl border border-[#d9d3ef] bg-[#faf9ff] px-4 py-3"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#625e69]">Add to class</p><p className="mt-1 font-bold text-[#27242d]">{className}</p></div>
      <div className="mt-6 flex justify-end gap-3 border-t border-dashboard-outline pt-5"><button type="button" onClick={onClose} disabled={sending} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#625e69] hover:bg-[#f5f3f2]">Cancel</button><button type="button" onClick={() => void submit()} disabled={sending || !firstName.trim() || !lastName.trim() || !email.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#241c70] disabled:opacity-50"><Mail size={17}/>{sending ? 'Sending…' : 'Send invitation'}</button></div>
    </div>
  </div>
}

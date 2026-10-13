"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { meetsPasswordPolicy } from "@/lib/password-policy"

type Invitation = { role: 'tutor' | 'student'; email: string; school_name: string; status: string; metadata?: { first_name?: string; last_name?: string; programme_name?: string } }

function CompleteInvitationContent() {
  const token = useSearchParams().get('token') || ''
  const supabase = useMemo(() => createClient(), [])
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    void Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invitation/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(async response => ({ response, body: await response.json().catch(() => null) })),
      supabase.auth.getUser(),
    ]).then(([preview, auth]) => {
      if (!preview.response.ok || !preview.body?.data) throw new Error(preview.body?.error || 'This invitation is unavailable.')
      if (!auth.data.user?.email) throw new Error('Your invitation session has expired. Open the original invitation link again.')
      if (auth.data.user.email.toLowerCase() !== preview.body.data.email.toLowerCase()) throw new Error('This invitation belongs to a different email address.')
      if (!live) return
      setInvitation(preview.body.data)
      setFirstName(auth.data.user.user_metadata?.first_name || preview.body.data.metadata?.first_name || '')
      setLastName(auth.data.user.user_metadata?.last_name || preview.body.data.metadata?.last_name || '')
    }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'This invitation is unavailable.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [supabase, token])

  const valid = firstName.trim() && lastName.trim() && meetsPasswordPolicy(password) && password === confirmation
  async function complete(event: React.FormEvent) {
    event.preventDefault()
    if (!invitation || !valid) return
    setSaving(true); setError('')
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password, data: { first_name: firstName.trim(), last_name: lastName.trim() } })
      if (passwordError) throw passwordError
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your invitation session has expired. Open the original invitation link again.')
      const endpoint = invitation.role === 'tutor' ? '/auth/profile/init' : '/auth/profile/activate'
      const body = invitation.role === 'tutor'
        ? { flow: 'tutor', first_name: firstName.trim(), last_name: lastName.trim(), account_invitation_token: token }
        : { first_name: firstName.trim(), last_name: lastName.trim(), account_invitation_token: token }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Your account could not be completed.')
      await supabase.auth.refreshSession()
      window.location.assign(invitation.role === 'student' ? '/dashboard/student' : '/dashboard')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your account could not be completed.')
      setSaving(false)
    }
  }

  return <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 sm:flex sm:items-center sm:justify-center"><section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10"><Link href="/" className="mb-9 block text-center text-2xl font-bold text-[#2e2877]">Kanvise</Link>
    {loading ? <div className="flex justify-center gap-3 py-16"><Loader2 className="animate-spin"/>Checking invitation…</div>
      : !invitation ? <div className="py-8 text-center"><h1 className="text-3xl font-bold text-[#2e2877]">Invitation unavailable</h1><p className="mt-3 text-sm text-[#6a6874]">{error}</p><Link href={`/invite?token=${encodeURIComponent(token)}`} className="mt-7 inline-flex rounded-lg bg-[#994704] px-6 py-3 font-bold text-white">Reopen invitation</Link></div>
      : <><header className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">{invitation.role} invitation</p><h1 className="mt-2 text-3xl font-bold text-[#2e2877]">Finish your account</h1><p className="mt-3 text-sm text-[#6a6874]">Create your password to join {invitation.school_name}.</p></header>{error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={complete} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={firstName} onChange={setFirstName}/><Field label="Last name" value={lastName} onChange={setLastName}/></div><Field label="Create password" value={password} onChange={setPassword} type="password"/><Field label="Confirm password" value={confirmation} onChange={setConfirmation} type="password"/>{confirmation && password !== confirmation && <p className="text-sm text-red-600">Passwords do not match.</p>}<button disabled={!valid || saving} className="flex w-full justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white disabled:opacity-50">{saving && <Loader2 className="animate-spin" size={18}/>} {saving ? 'Completing account…' : 'Complete account'}</button></form></>}
  </section></main>
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-xs font-bold uppercase tracking-wider text-[#474551]">{label}<input required type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#c8c5d2] px-4 py-3.5 font-normal normal-case tracking-normal outline-none focus:border-[#2e2877]"/></label> }

export default function CompleteInvitationPage() { return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]"/>}><CompleteInvitationContent/></Suspense> }

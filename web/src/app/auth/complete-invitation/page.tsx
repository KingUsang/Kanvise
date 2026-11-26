"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { meetsPasswordPolicy, PASSWORD_REQUIREMENTS } from "@/lib/password-policy"
import { AuthAlert, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { passwordUpdateErrorMessage } from '@/lib/auth-error-message'

type Invitation = { role: 'tutor' | 'student'; email: string; school_name: string; status: string; metadata?: { first_name?: string; last_name?: string; programme_name?: string } }

function CompleteInvitationContent() {
  const token = useSearchParams().get('token') || ''
  const supabase = useMemo(() => createClient(), [])
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    let live = true
    void Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invitation/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(async response => ({ response, body: await response.json().catch(() => null) })),
      supabase.auth.getUser(),
    ]).then(([preview, auth]) => {
      if (!preview.response.ok || !preview.body?.data) throw new Error('invitation_unavailable')
      if (!auth.data.user?.email) throw new Error('session_unavailable')
      if (auth.data.user.email.toLowerCase() !== preview.body.data.email.toLowerCase()) throw new Error('email_mismatch')
      if (!live) return
      setInvitation(preview.body.data)
      setFullName(`${auth.data.user.user_metadata?.first_name || preview.body.data.metadata?.first_name || ''} ${auth.data.user.user_metadata?.last_name || preview.body.data.metadata?.last_name || ''}`.trim())
    }).catch(reason => {
      if (!live) return
      const code = reason instanceof Error ? reason.message : ''
      setError(code === 'email_mismatch'
        ? 'This invitation was sent to a different email address. Sign in with the invited account to continue.'
        : code === 'session_unavailable'
          ? "Your sign-in didn't finish. Open the invitation again to continue."
          : "This invitation link isn't valid. Check that you copied the full link, or ask the person who invited you to send another.")
    })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [supabase, token])

  const nameParts = fullName.trim().split(/\s+/), firstName = nameParts.slice(0, -1).join(' '), lastName = nameParts.at(-1) || ''
  const valid = firstName && lastName && meetsPasswordPolicy(password) && password === confirmation
  async function complete(event: React.FormEvent) {
    event.preventDefault()
    if (!invitation || !valid) return
    setSaving(true); setError('')
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password, data: { first_name: firstName.trim(), last_name: lastName.trim() } })
      if (passwordError) {
        setError(passwordUpdateErrorMessage(passwordError))
        setSaving(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('session_unavailable')
      const endpoint = invitation.role === 'tutor' ? '/auth/profile/init' : '/auth/profile/activate'
      const body = invitation.role === 'tutor'
        ? { flow: 'tutor', first_name: firstName.trim(), last_name: lastName.trim(), account_invitation_token: token }
        : { first_name: firstName.trim(), last_name: lastName.trim(), account_invitation_token: token }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('invitation_completion_failed')
      await supabase.auth.refreshSession()
      window.location.assign(invitation.role === 'student' ? '/dashboard/student' : '/dashboard')
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'session_unavailable'
        ? "Your sign-in didn't finish. Open the invitation again to continue."
        : "We couldn't finish accepting this invitation right now. Try again.")
      setSaving(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8"><section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12"><Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
    {loading ? <div className="flex justify-center gap-3 py-16"><Loader2 className="animate-spin"/>Checking invitation…</div>
      : !invitation ? <div className="py-6 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Invitation unavailable</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">{error}</p><Link href={token ? `/invite?token=${encodeURIComponent(token)}` : '/auth/login'} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#994704] px-6 text-sm font-semibold text-white">{token ? 'Return to invitation' : 'Back to sign in'}</Link></div>
      : <><header className="mb-7 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Complete your account creation</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">Create your password to join {invitation.school_name}.</p></header>{error && <AuthAlert>{error}</AuthAlert>}<form onSubmit={complete} className="space-y-5"><Field label="Full name" value={fullName} onChange={setFullName}/><PasswordField label="Create password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(value => !value)}/><p className="-mt-3 text-xs leading-5 text-[#716d78]">{PASSWORD_REQUIREMENTS}</p><PasswordField label="Confirm password" value={confirmation} onChange={setConfirmation} visible={showConfirmation} onToggle={() => setShowConfirmation(value => !value)}/>{confirmation && password !== confirmation && <p className="text-sm text-[#a33a2b]">Passwords do not match.</p>}<button disabled={!valid || saving} className={authPrimaryButtonClass}>{saving ? <><Loader2 className="animate-spin" size={18}/>Completing account…</> : <>Complete account<ArrowRight size={16}/></>}</button></form></>}
  </section></main>
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-[#302c39]">{label}<input required value={value} onChange={event => onChange(event.target.value)} className={`${authInputClass} mt-2`}/></label> }
function PasswordField({ label, value, onChange, visible, onToggle }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) { return <label className="block text-sm font-medium text-[#302c39]">{label}<span className="relative mt-2 block"><input required autoComplete="new-password" type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} className={`${authInputClass} pr-12`}/><button type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#777382] hover:bg-[#f2f0f7]">{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label> }

export default function CompleteInvitationPage() { return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]"/>}><CompleteInvitationContent/></Suspense> }

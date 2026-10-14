'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { AuthAlert, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { createClient } from '@/lib/supabase/client'

type Context = { intent: 'login' | 'educator' | 'student' | 'invitation'; account_type?: 'independent' | 'centre'; email: string; first_name: string; last_name: string; invitation_token?: string; invitation?: { role: 'tutor' | 'student'; school_name: string; metadata?: { programme_name?: string } } }

export default function CompleteProfilePage() {
  const [context, setContext] = useState<Context | null>(null)
  const [fullName, setFullName] = useState(''), [centreName, setCentreName] = useState('')
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [emailMismatch, setEmailMismatch] = useState(false)
  useEffect(() => { void fetch('/api/auth/oauth-context', { cache: 'no-store' }).then(async response => { const body = await response.json().catch(() => null); if (!response.ok || !body?.data) throw new Error('oauth_context_unavailable'); setContext(body.data); setFullName(`${body.data.first_name || ''} ${body.data.last_name || ''}`.trim()) }).catch(() => setError("Your sign-in couldn't be completed. Open the sign-in page and try again.")).finally(() => setLoading(false)) }, [])

  async function complete(event: React.FormEvent) {
    event.preventDefault(); if (!context) return
    const parts = fullName.trim().split(/\s+/), firstName = parts.slice(0, -1).join(' '), lastName = parts.at(-1) || ''
    if (!firstName || !lastName) { setError('Enter your full name.'); return }
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/auth/oauth-complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: firstName, last_name: lastName, centre_name: centreName, invitation_role: context.invitation?.role }) })
      const body = await response.json().catch(() => null)
      if (body?.code === 'INVITATION_EMAIL_MISMATCH') {
        setEmailMismatch(true)
        setError('This invitation was sent to a different email address. Sign in with the invited account to continue.')
        setSaving(false)
        return
      }
      if (!response.ok || !body?.destination) throw new Error('oauth_completion_failed')
      window.location.assign(body.destination)
    } catch { setError("We couldn't finish setting up your account. Try again."); setSaving(false) }
  }

  async function switchAccount() {
    await createClient().auth.signOut()
    window.location.assign(context?.invitation_token ? `/invite?token=${encodeURIComponent(context.invitation_token)}` : '/auth/login')
  }

  const heading = context?.intent === 'invitation' ? `Join ${context.invitation?.school_name || 'your tutorial agency'}` : context?.intent === 'student' ? 'Finish joining your programme' : 'Let’s finish setting up your account'
  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8"><section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12"><Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
    {loading ? <div className="flex min-h-56 items-center justify-center gap-3 text-[#474551]"><Loader2 className="animate-spin"/>Opening your account…</div>
      : !context ? <div className="py-6 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Your session has expired</h1><p role="alert" className="mt-3 text-sm leading-6 text-[#625e6e]">{error}</p><Link href="/auth/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white">Back to sign in</Link></div>
      : <><header className="mb-7 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">{heading}</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">Signed in as <span className="font-medium text-[#302c39]">{context.email}</span>.</p>{context.invitation?.metadata?.programme_name && <p className="mt-3 rounded-xl border border-[#dedbec] bg-[#f7f6fc] p-3 text-sm text-[#2e2877]">{context.invitation.metadata.programme_name}</p>}</header>
      {error && <AuthAlert>{error}</AuthAlert>}
      <form onSubmit={complete} className="space-y-5"><Field label="Full name" value={fullName} onChange={setFullName}/>{context.intent === 'educator' && context.account_type === 'centre' && <Field label="Tutorial agency name" value={centreName} onChange={setCentreName}/>}<button disabled={saving} className={authPrimaryButtonClass}>{saving ? <><Loader2 className="animate-spin" size={18}/>Finishing account…</> : <>Continue<ArrowRight size={16}/></>}</button></form>{emailMismatch && <button type="button" onClick={() => void switchAccount()} className="mt-4 w-full text-center text-sm font-medium text-[#2e2877] hover:underline">Use the invited account instead</button>}</>}
  </section></main>
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-[#302c39]">{label}<input required value={value} onChange={event => onChange(event.target.value)} className={`${authInputClass} mt-2`}/></label> }

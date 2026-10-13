'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Loader2, UserRound } from 'lucide-react'
import { AuthLogo } from '@/components/auth/auth-logo'

type Context = { intent: 'login' | 'educator' | 'student' | 'invitation'; account_type?: 'independent' | 'centre'; email: string; first_name: string; last_name: string; invitation?: { role: 'tutor' | 'student'; school_name: string; metadata?: { programme_name?: string } } }

export default function CompleteProfilePage() {
  const [context, setContext] = useState<Context | null>(null)
  const [firstName, setFirstName] = useState(''), [lastName, setLastName] = useState(''), [centreName, setCentreName] = useState('')
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('')
  useEffect(() => { void fetch('/api/auth/oauth-context', { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setContext(body.data); setFirstName(body.data.first_name); setLastName(body.data.last_name) }).catch(reason => setError(reason.message || 'Your sign-in could not be completed.')).finally(() => setLoading(false)) }, [])

  async function complete(event: React.FormEvent) {
    event.preventDefault(); if (!context) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/auth/oauth-complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: firstName, last_name: lastName, centre_name: centreName, invitation_role: context.invitation?.role }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Your account could not be completed.')
      window.location.assign(body.destination)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your account could not be completed.'); setSaving(false) }
  }

  const heading = context?.intent === 'invitation' ? `Join ${context.invitation?.school_name || 'your tutorial centre'}` : context?.intent === 'student' ? 'Finish joining your programme' : 'Finish setting up your account'
  return <main className="min-h-screen bg-[#f7f5f3] px-4 py-8 sm:flex sm:items-center sm:justify-center sm:py-12"><section className="mx-auto w-full max-w-xl rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-[0_12px_40px_rgba(46,40,119,.08)] sm:p-10"><AuthLogo className="mb-8"/>
    {loading ? <div className="flex min-h-56 items-center justify-center gap-3 text-[#474551]"><Loader2 className="animate-spin"/>Opening your account…</div>
      : !context ? <div className="py-8 text-center"><h1 className="text-3xl font-bold text-[#2e2877]">Sign-in session unavailable</h1><p role="alert" className="mt-3 text-sm text-[#6a6874]">{error}</p><Link href="/auth/login" className="mt-7 inline-flex rounded-xl bg-[#2e2877] px-5 py-3 font-semibold text-white">Return to login</Link></div>
      : <><header className="mb-7 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0edff] text-[#2e2877]">{context.account_type === 'centre' ? <Building2/> : <UserRound/>}</span><h1 className="mt-4 text-3xl font-bold text-[#2e2877]">{heading}</h1><p className="mt-2 text-sm leading-6 text-[#6a6874]">Signed in as <strong className="text-[#1b1c1c]">{context.email}</strong>. Confirm how your name should appear.</p>{context.invitation?.metadata?.programme_name && <p className="mt-2 rounded-xl bg-[#f5f3ff] p-3 text-sm text-[#2e2877]">Programme: {context.invitation.metadata.programme_name}</p>}</header>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={complete} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={firstName} onChange={setFirstName}/><Field label="Last name" value={lastName} onChange={setLastName}/></div>{context.intent === 'educator' && context.account_type === 'centre' && <Field label="Tutorial centre name" value={centreName} onChange={setCentreName}/>}<button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 font-bold text-white disabled:opacity-60">{saving && <Loader2 className="animate-spin" size={18}/>} {saving ? 'Finishing account…' : 'Continue to Kanvise'}</button></form></>}
  </section></main>
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold text-[#474551]">{label}<input required value={value} onChange={event => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#c8c5d2] px-4 font-normal text-[#1b1c1c] outline-none focus:border-[#2e2877] focus:ring-2 focus:ring-[#2e2877]/15"/></label> }

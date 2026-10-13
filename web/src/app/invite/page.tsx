"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Invitation = { role: 'tutor' | 'student'; email: string; school_name: string; status: string; expires_at: string; metadata?: { programme_name?: string } }
const INVITATION_TRACE_KEY = 'kanvise.invitation.trace'

function traceInvitation(event: string, details: Record<string, unknown> = {}) {
  const entry = { at: new Date().toISOString(), event, ...details }
  console.info(`[invitation] ${event}`, details)
  try {
    const previous = JSON.parse(sessionStorage.getItem(INVITATION_TRACE_KEY) || '[]')
    sessionStorage.setItem(INVITATION_TRACE_KEY, JSON.stringify([...previous.slice(-9), entry]))
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
}

function InviteContent() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const token = params.get('token') || ''
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const previous = JSON.parse(sessionStorage.getItem(INVITATION_TRACE_KEY) || '[]')
      if (previous.length) console.info('[invitation] previous attempt trace', previous)
    } catch {
      // Storage may be unavailable in privacy-restricted browsers.
    }
  }, [])

  useEffect(() => {
    let live = true
    void fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invitation/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async response => {
      const body = await response.json().catch(() => null)
      traceInvitation('preview response', {
        status: response.status,
        cache: response.headers.get('x-vercel-cache') || response.headers.get('cf-cache-status') || null,
      })
      if (!response.ok || !body?.data) throw new Error(body?.error || 'This invitation link is invalid.')
      if (body.data.status === 'accepted') {
        const { data } = await supabase.auth.getUser()
        if (data.user) {
          router.replace(body.data.role === 'student' ? '/dashboard/student' : '/dashboard')
          return
        }
      }
      if (live) setInvitation(body.data)
    }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'This invitation could not be opened.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [router, supabase, token])

  async function continueInvitation() {
    if (!token || starting) return
    setStarting(true); setError('')
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invitation/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      const body = await response.json().catch(() => null)
      traceInvitation('start response', { status: response.status })
      if (!response.ok || !body?.data?.action_url) throw new Error(body?.error || 'This invitation could not be started.')
      const actionUrl = new URL(body.data.action_url)
      traceInvitation('redirecting to auth action', {
        host: actionUrl.host,
        path: actionUrl.pathname,
        hasRedirect: actionUrl.searchParams.has('redirect_to'),
      })
      window.location.assign(actionUrl.toString())
    } catch (reason) {
      traceInvitation('start failed', { message: reason instanceof Error ? reason.message : String(reason) })
      setError(reason instanceof Error ? reason.message : 'This invitation could not be started.')
      setStarting(false)
    }
  }

  const unavailable = invitation && invitation.status !== 'pending'
  return <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 text-[#1b1c1c] sm:flex sm:items-center sm:justify-center">
    <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10">
      <Link href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-[#2e2877]">Kanvise</Link>
      {loading ? <div className="flex min-h-64 items-center justify-center gap-3"><Loader2 className="animate-spin" />Opening your invitation…</div>
        : error && !invitation ? <Recovery message={error} />
        : unavailable ? <Recovery message={invitation.status === 'accepted' ? 'This invitation has already been accepted. Sign in to continue.' : `This invitation has ${invitation.status}. Ask your tutorial centre to send a new one.`} />
        : invitation ? <>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f3ff] text-[#2e2877]"><Mail /></div>
          <header className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">{invitation.role} invitation</p><h1 className="mt-2 text-3xl font-bold text-[#2e2877]">Join {invitation.school_name}</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">Continue as <strong>{invitation.email}</strong>{invitation.metadata?.programme_name ? ` to access ${invitation.metadata.programme_name}` : ''}.</p></header>
          {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button onClick={() => void continueInvitation()} disabled={starting} className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] px-6 py-4 font-bold text-white disabled:opacity-60">{starting ? <><Loader2 className="animate-spin" size={18}/>Preparing account…</> : <><CheckCircle2 size={18}/>Continue to account setup</>}</button>
        </> : null}
    </section>
  </main>
}

function Recovery({ message }: { message: string }) {
  return <div className="py-6 text-center"><h1 className="text-3xl font-bold text-[#2e2877]">Invitation unavailable</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">{message}</p><Link href="/auth/login" className="mt-7 inline-flex rounded-lg bg-[#994704] px-6 py-3 font-bold text-white">Sign in to Kanvise</Link></div>
}

export default function InvitePage() { return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><InviteContent /></Suspense> }

"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthMethodDivider, GoogleAuthButton } from '@/components/auth/google-auth-button'
import { AuthAlert, AuthHeading, authPrimaryButtonClass } from '@/components/auth/auth-ui'

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
  const [canRetry, setCanRetry] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

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
      if (!response.ok || !body?.data) {
        if (response.status >= 500 || response.status === 429) {
          throw new Error('We could not check this invitation right now. Try again.')
        }
        const invalidInvitation = new Error("This invitation link isn't valid. Check that you copied the full link, or ask the person who invited you to send another.")
        invalidInvitation.name = 'InvalidInvitationError'
        throw invalidInvitation
      }
      if (body.data.status === 'accepted') {
        const { data } = await supabase.auth.getUser()
        if (data.user) {
          router.replace(body.data.role === 'student' ? '/dashboard/student' : '/dashboard')
          return
        }
      }
      if (live) setInvitation(body.data)
    }).catch(reason => { if (live) { setError(reason instanceof Error ? reason.message : 'We could not check this invitation right now. Try again.'); setCanRetry(!(reason instanceof Error && reason.name === 'InvalidInvitationError')) } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [retryCount, router, supabase, token])

  async function continueInvitation() {
    if (!token || starting) return
    setStarting(true); setError('')
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/invitation/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      const body = await response.json().catch(() => null)
      traceInvitation('start response', { status: response.status })
      if (!response.ok || !body?.data?.action_url) {
        if (body?.code === 'INVITATION_RATE_LIMITED') throw new Error('Too many attempts were made. Wait a few minutes and try again.')
        if (body?.code === 'INVITATION_EXPIRED') throw new Error('This invitation has expired. Ask the person who invited you to send another.')
        throw new Error('We could not start this invitation right now. Try again.')
      }
      const actionUrl = new URL(body.data.action_url)
      traceInvitation('redirecting to auth action', {
        host: actionUrl.host,
        path: actionUrl.pathname,
        hasRedirect: actionUrl.searchParams.has('redirect_to'),
      })
      window.location.assign(actionUrl.toString())
    } catch (reason) {
      traceInvitation('start failed', { message: reason instanceof Error ? reason.message : String(reason) })
      setError(reason instanceof Error ? reason.message : 'We could not start this invitation right now. Try again.')
      setCanRetry(true)
      setStarting(false)
    }
  }

  const unavailable = invitation && invitation.status !== 'pending'
  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className={`grid w-full overflow-hidden rounded-[20px] border border-[#e1e0e6] bg-white sm:rounded-[24px] ${invitation && !unavailable ? 'max-w-[1040px] lg:grid-cols-[.9fr_1.1fr]' : 'max-w-[500px]'}`}>
      {invitation && !unavailable ? <aside className="hidden border-r border-[#dedbec] bg-[#f4f3fa] p-10 lg:flex lg:flex-col lg:justify-center">
        <p className="text-sm font-medium text-[#625e6e]">You’re invited to</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-.025em] text-[#211969]">{invitation.metadata?.programme_name || invitation.school_name}</h2>
        {invitation.metadata?.programme_name ? <p className="mt-2 text-sm text-[#625e6e]">{invitation.school_name}</p> : null}
        <dl className="mt-8 space-y-5 border-t border-[#dedbec] pt-6 text-sm"><div><dt className="text-[#777382]">Joining as</dt><dd className="mt-1 font-medium capitalize text-[#302c39]">{invitation.role}</dd></div><div><dt className="text-[#777382]">Invited email</dt><dd className="mt-1 break-words font-medium text-[#302c39]">{invitation.email}</dd></div></dl>
      </aside> : null}
      <div className="px-5 py-8 sm:px-10 sm:py-11 lg:px-12"><Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
      <div className="mx-auto max-w-[430px]">
      {loading ? <div className="flex min-h-64 items-center justify-center gap-3"><Loader2 className="animate-spin" />Opening your invitation…</div>
        : error && !invitation ? <Recovery message={error} canRetry={canRetry} onRetry={() => { setError(''); setCanRetry(false); setLoading(true); setRetryCount(value => value + 1) }} />
        : unavailable ? <Recovery message={invitationStatusMessage(invitation.status)} />
        : invitation ? <>
          <div className="text-center [&_p]:mx-auto"><AuthHeading title={invitation.role === 'student' ? 'Accept your invitation' : `Join ${invitation.school_name}`} description={<>Continue with <span className="font-medium text-[#302c39]">{invitation.email}</span>.</>}/></div>
          <div className="mb-6 rounded-xl border border-[#dedbea] bg-[#faf9ff] p-4 lg:hidden"><p className="font-medium text-[#211969]">{invitation.metadata?.programme_name || invitation.school_name}</p>{invitation.metadata?.programme_name ? <p className="mt-1 text-sm text-[#625e6e]">{invitation.school_name}</p> : null}<p className="mt-3 text-sm capitalize text-[#625e6e]">Joining as {invitation.role}</p></div>
          {error && <AuthAlert>{error}</AuthAlert>}
          <GoogleAuthButton href={`/api/auth/google?intent=invitation&invitation_token=${encodeURIComponent(token)}`} label="Continue with Google"/><AuthMethodDivider/><button onClick={() => void continueInvitation()} disabled={starting} className={authPrimaryButtonClass}>{starting ? <><Loader2 className="animate-spin" size={18}/>Preparing…</> : <>Continue with email<ArrowRight size={16}/></>}</button>
        </> : null}
      </div>
      </div>
    </section>
  </main>
}

function invitationStatusMessage(status: string) {
  if (status === 'accepted') return "You've already accepted this invitation. Sign in with the invited account to continue."
  if (status === 'expired') return 'This invitation has expired. Ask the person who invited you to send another.'
  if (status === 'revoked' || status === 'cancelled') return 'This invitation is no longer available. Contact the person who sent it if you still need access.'
  return 'This invitation is no longer pending. Ask the person who invited you to check it.'
}

function Recovery({ message, canRetry = false, onRetry }: { message: string; canRetry?: boolean; onRetry?: () => void }) {
  return <div className="py-5 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Invitation unavailable</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">{message}</p>{canRetry && onRetry ? <button type="button" onClick={onRetry} className={`${authPrimaryButtonClass} mt-7`}>Try again<ArrowRight size={16}/></button> : <Link href="/auth/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-6 text-sm font-semibold text-white">Sign in<ArrowRight size={16}/></Link>}</div>
}

export default function InvitePage() { return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><InviteContent /></Suspense> }

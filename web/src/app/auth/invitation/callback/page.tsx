"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { readInvitationSessionFragment } from "@/lib/invitation-session"

const TRACE_KEY = "kanvise.invitation.trace"

function trace(event: string, details: Record<string, unknown> = {}) {
  console.info(`[invitation/callback] ${event}`, details)
  try {
    const previous = JSON.parse(sessionStorage.getItem(TRACE_KEY) || "[]")
    sessionStorage.setItem(TRACE_KEY, JSON.stringify([
      ...previous.slice(-9),
      { at: new Date().toISOString(), event, ...details },
    ]))
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
}

function InvitationCallbackContent() {
  const params = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const token = params.get("account_invitation_token") || ""
  const started = useRef(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (started.current) return
    started.current = true
    let live = true

    async function consumeSession() {
      if (!token) {
        trace("missing invitation token")
        if (live) setError("This invitation link is incomplete.")
        return
      }

      trace("callback opened", {
        hasHash: Boolean(window.location.hash),
        hasCode: Boolean(params.get("code")),
      })

      // Admin-generated Supabase action links return an implicit-grant
      // session in the URL fragment. @supabase/ssr deliberately forces PKCE,
      // so it will not consume that fragment automatically. Transfer the
      // tokens into the normal cookie-backed client explicitly.
      const fragment = readInvitationSessionFragment(window.location.hash)
      window.history.replaceState({}, "", `/auth/invitation/callback?account_invitation_token=${encodeURIComponent(token)}`)

      if (fragment.error) {
        trace("invalid session fragment", { message: fragment.error })
        if (live) setError(fragment.error)
        return
      }

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: fragment.accessToken,
        refresh_token: fragment.refreshToken,
      })
      trace("session handoff", {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.session?.user),
        error: sessionError?.message || null,
      })

      if (sessionError || !data.session?.user) {
        if (live) setError("Your invitation session could not be opened. Please use the original email link again.")
        return
      }

      window.location.replace(`/auth/complete-invitation?token=${encodeURIComponent(token)}`)
    }

    void consumeSession().catch(reason => {
      trace("session handoff failed", { message: reason instanceof Error ? reason.message : String(reason) })
      if (live) setError("Your invitation session could not be opened. Please use the original email link again.")
    })

    return () => { live = false }
  }, [params, supabase, token])

  return <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 text-[#1b1c1c] sm:flex sm:items-center sm:justify-center">
    <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10">
      <Link href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-[#2e2877]">Kanvise</Link>
      {error ? <div className="py-6 text-center">
        <h1 className="text-3xl font-bold text-[#2e2877]">Invitation unavailable</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-[#6a6874]">{error}</p>
        <Link href={token ? `/invite?token=${encodeURIComponent(token)}` : "/auth/login"} className="mt-7 inline-flex rounded-lg bg-[#994704] px-6 py-3 font-bold text-white">Open invitation again</Link>
      </div> : <div className="flex min-h-64 items-center justify-center gap-3 text-[#6a6874]"><Loader2 className="animate-spin" />Opening your account setup…</div>}
    </section>
  </main>
}

export default function InvitationCallbackPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><InvitationCallbackContent /></Suspense>
}

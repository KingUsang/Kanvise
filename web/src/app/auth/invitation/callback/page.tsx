"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { readInvitationSessionFragment } from "@/lib/invitation-session"

const TRACE_KEY = "kanvise.invitation.trace"
const INVITATION_RECOVERY_MESSAGE = "Your sign-in didn’t finish. Open the invitation again to continue."

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
        if (live) setError(INVITATION_RECOVERY_MESSAGE)
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
        trace("invalid session fragment")
        if (live) setError(INVITATION_RECOVERY_MESSAGE)
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
        if (live) setError(INVITATION_RECOVERY_MESSAGE)
        return
      }

      window.location.replace(`/auth/complete-invitation?token=${encodeURIComponent(token)}`)
    }

    void consumeSession().catch(reason => {
      trace("session handoff failed", { message: reason instanceof Error ? reason.message : String(reason) })
      if (live) setError(INVITATION_RECOVERY_MESSAGE)
    })

    return () => { live = false }
  }, [params, supabase, token])

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
      <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
      {error ? <div className="py-6 text-center">
        <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Invitation unavailable</h1>
        <p role="alert" className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">{error}</p>
        <Link href={token ? `/invite?token=${encodeURIComponent(token)}` : "/auth/login"} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-6 text-sm font-semibold text-white">{token ? <>Return to invitation<ArrowRight aria-hidden size={16}/></> : <><ArrowLeft aria-hidden size={16}/>Back to sign in</>}</Link>
      </div> : <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#625e6e]"><Loader2 className="animate-spin" size={19}/>Opening your account…</div>}
    </section>
  </main>
}

export default function InvitationCallbackPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><InvitationCallbackContent /></Suspense>
}

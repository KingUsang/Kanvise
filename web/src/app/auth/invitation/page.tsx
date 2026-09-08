"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { AuthLogo } from "@/components/auth/auth-logo"
import { createClient } from "@/lib/supabase/client"

const INVALID_INVITATION = "This invitation link has expired or was already used. Ask your tutorial centre to invite you again."

export default function InvitationPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const linkRead = useRef(false)
  const [tokenHash, setTokenHash] = useState("")
  const [checking, setChecking] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (linkRead.current) return
    linkRead.current = true

    const params = new URLSearchParams(window.location.search)
    const token = params.get("token_hash") || ""
    const type = params.get("type")

    // Keep the one-time token out of the visible address and browser history.
    window.history.replaceState({}, "", window.location.pathname)

    if (type !== "invite" || token.length < 16 || token.length > 512) {
      setError(INVALID_INVITATION)
    } else {
      setTokenHash(token)
    }
    setChecking(false)
  }, [])

  async function continueToSetup() {
    if (!tokenHash || verifying) return
    setVerifying(true)
    setError(null)

    const { data, error: verificationError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    })

    if (verificationError || !data.session) {
      setError(INVALID_INVITATION)
      setVerifying(false)
      return
    }

    router.push("/auth/accept-invitation")
    router.refresh()
  }

  return <div className="min-h-screen bg-surface-container-low p-6 font-body-md text-on-surface sm:flex sm:items-center sm:justify-center">
    <main className="w-full max-w-[480px]">
      <AuthLogo className="mb-stack-lg" />
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0px_4px_20px_rgba(61,61,61,0.08)] sm:p-10">
        {checking ? <div className="flex items-center justify-center gap-3 py-12 text-on-surface-variant"><Loader2 className="h-5 w-5 animate-spin" />Opening your invitation…</div> : error ? <>
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Invitation unavailable</p>
            <h1 className="mt-3 font-headline-lg text-headline-lg font-bold tracking-tight">This link cannot be used</h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-on-surface-variant">{error}</p>
          </header>
          <div className="mt-8 grid gap-3">
            <Link href="/auth/login" className="rounded-lg bg-secondary px-6 py-4 text-center font-semibold text-on-secondary">Go to login</Link>
            <Link href="/auth/forgot-password" className="rounded-lg border border-outline-variant px-6 py-4 text-center font-semibold text-primary">I already have an account</Link>
          </div>
        </> : <>
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Student invitation</p>
            <h1 className="mt-3 font-headline-lg text-headline-lg font-bold tracking-tight">You’ve been invited to Kanvise</h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">Continue to confirm this invitation, create your password, and open your learning dashboard.</p>
          </header>
          <div className="mt-6 rounded-lg border border-outline-variant bg-surface p-4 text-sm leading-6 text-on-surface-variant">
            This one-time invitation is confirmed only when you press the button below. If you were not expecting it, close this page.
          </div>
          <button type="button" disabled={verifying} onClick={() => void continueToSetup()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-4 font-semibold text-on-secondary disabled:opacity-70">
            {verifying ? <><Loader2 className="h-5 w-5 animate-spin" />Confirming invitation…</> : "Continue to account setup"}
          </button>
        </>}
      </section>
    </main>
  </div>
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, KeyRound, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { authPrimaryButtonClass } from '@/components/auth/auth-ui'

const INVALID_INVITATION = "This invitation link has expired or was already used. Ask your tutorial agency to invite you again."

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

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
      <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
        <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
        {checking ? <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-[#625e6e]"><Loader2 className="h-5 w-5 animate-spin" />Opening your invitation…</div> : error ? <>
          <header className="text-center">
            <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">This link can’t be used</h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-[#625e6e]">{error}</p>
          </header>
          <div className="mt-8 grid gap-3">
            <Link href="/auth/login" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#994704] px-6 text-sm font-semibold text-white"><ArrowLeft aria-hidden size={16}/>Back to sign in</Link>
            <Link href="/auth/forgot-password" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d7d5df] px-6 text-sm font-medium text-[#2e2877]"><KeyRound aria-hidden size={16}/>Reset password</Link>
          </div>
        </> : <>
          <header className="text-center">
            <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">You’ve been invited</h1>
            <p className="mt-3 text-sm leading-6 text-[#625e6e]">Continue to confirm your invitation and finish setting up your account.</p>
          </header>
          <button type="button" disabled={verifying} onClick={() => void continueToSetup()} className={`${authPrimaryButtonClass} mt-8`}>
            {verifying ? <><Loader2 className="h-5 w-5 animate-spin" />Confirming invitation…</> : <>Continue<ArrowRight size={16}/></>}
          </button>
        </>}
      </section>
  </main>
}

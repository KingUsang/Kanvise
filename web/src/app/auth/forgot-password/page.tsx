"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthAlert, AuthHeading, authInputClass, authPrimaryButtonClass } from "@/components/auth/auth-ui"
import { VerificationCodeInput } from '@/components/auth/verification-code-input'
import { recoveryRequestErrorMessage, verificationErrorMessage } from '@/lib/auth-error-message'
import { maskEmail } from '@/lib/mask-email'

type Step = "email" | "code"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (!resendIn) return
    const interval = window.setInterval(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [resendIn])

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setError(null)
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email)
    setLoading(false)
    if (recoveryError) return setError(recoveryRequestErrorMessage(recoveryError))
    setCode("")
    setResendIn(60)
    setStep("code")
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError("Enter the six-digit code from your email.")
    setLoading(true)
    setError(null)
    const { data, error: verificationError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    })
    setLoading(false)
    if (verificationError || !data.session) return setError(verificationErrorMessage(verificationError))
    router.push("/auth/reset-password")
    router.refresh()
  }

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
      <div className="mx-auto w-full max-w-[404px]">
        <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
        {step === "email" ? <>
          <div className="text-center [&_p]:mx-auto"><AuthHeading title="Reset your password" description="Enter the email associated with your Kanvise account. We’ll guide you through resetting your password." /></div>
          <form className="space-y-6" onSubmit={sendCode}>
            <label className="block text-sm font-medium text-[#302c39]" htmlFor="email">Email address<input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={`mt-2 ${authInputClass}`} /></label>
            {error && <AuthAlert>{error}</AuthAlert>}
            <button disabled={loading} type="submit" className={authPrimaryButtonClass}>{loading ? <><Loader2 className="h-5 w-5 animate-spin" />Sending code…</> : <>Send recovery code<Send size={16}/></>}</button>
          </form>
          <p className="mt-5 text-center text-sm leading-6 text-[#625e6e]">Usually sign in with Google? <Link href="/auth/login" className="font-medium text-[#2e2877] hover:underline">Return to sign in</Link> and choose Google.</p>
        </> : <>
          <div className="text-center [&_p]:mx-auto"><AuthHeading title="Check your email" description={<>Enter the recovery code sent to <span className="font-medium text-[#302c39]">{maskEmail(email)}</span>.</>} /></div>
          <form className="space-y-6" onSubmit={verifyCode}>
            <VerificationCodeInput id="recovery-code" label="Recovery code" value={code} onChange={setCode} disabled={loading} />
            {error && <AuthAlert>{error}</AuthAlert>}
            <button disabled={loading || code.length !== 6} type="submit" className={authPrimaryButtonClass}>{loading ? <><Loader2 className="h-5 w-5 animate-spin" />Verifying…</> : <>Verify code<Check size={16}/></>}</button>
          </form>
          <div className="mt-6 text-center text-sm text-[#625e6e]">{resendIn ? <span>Resend code in 0:{String(resendIn).padStart(2, '0')}</span> : <button type="button" onClick={() => void sendCode()} className="font-semibold text-[#2e2877] hover:underline">Resend code</button>}</div>
          <button type="button" onClick={() => { setStep("email"); setError(null); setCode("") }} className="mt-4 w-full text-sm font-semibold text-[#625e6e] hover:text-[#2e2877]">Use a different email</button>
        </>}
        <footer className="mt-8 border-t border-[#e8e5ee] pt-6 text-center"><Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2e2877] hover:underline"><ArrowLeft size={15}/>Back to sign in</Link></footer>
      </div>
    </section>
  </main>
}

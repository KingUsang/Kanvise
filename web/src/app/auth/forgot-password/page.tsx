"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthLogo } from "@/components/auth/auth-logo"

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
    if (recoveryError) return setError(recoveryError.message)
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
    if (verificationError || !data.session) return setError(verificationError?.message || "That code is invalid or has expired.")
    router.push("/auth/reset-password")
    router.refresh()
  }

  return <div className="min-h-screen bg-surface-container-low p-6 font-body-md text-on-surface sm:flex sm:items-center sm:justify-center">
    <main className="w-full max-w-[480px]">
      <AuthLogo className="mb-stack-lg" />
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0px_4px_20px_rgba(61,61,61,0.08)] sm:p-10">
        {step === "email" ? <>
          <header className="mb-stack-lg"><h1 className="font-headline-lg text-headline-lg font-bold tracking-tight">Reset your password</h1><p className="mt-2 text-sm leading-6 text-on-surface-variant">Enter your email address and we’ll send a six-digit reset code.</p></header>
          <form className="space-y-6" onSubmit={sendCode}>
            <label className="block text-sm font-semibold" htmlFor="email">Email address<input id="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-lg border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-primary" /></label>
            {error && <p role="alert" className="rounded-lg border border-error/20 bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
            <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-4 font-semibold text-on-secondary disabled:opacity-70">{loading ? <><Loader2 className="h-5 w-5 animate-spin" />Sending code…</> : "Send reset code"}</button>
          </form>
        </> : <>
          <header className="mb-stack-lg"><h1 className="font-headline-lg text-headline-lg font-bold tracking-tight">Check your email</h1><p className="mt-2 text-sm leading-6 text-on-surface-variant">Enter the six-digit code sent to <strong>{email}</strong>. It expires in one hour.</p></header>
          <form className="space-y-6" onSubmit={verifyCode}>
            <label className="block text-sm font-semibold" htmlFor="recovery-code">Reset code<input id="recovery-code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" className="mt-2 w-full rounded-lg border border-outline-variant bg-surface px-4 py-3 text-center text-2xl font-semibold tracking-[0.45em] outline-none focus:border-primary" /></label>
            {error && <p role="alert" className="rounded-lg border border-error/20 bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
            <button disabled={loading || code.length !== 6} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-4 font-semibold text-on-secondary disabled:opacity-70">{loading ? <><Loader2 className="h-5 w-5 animate-spin" />Verifying…</> : "Continue"}</button>
          </form>
          <div className="mt-6 text-center text-sm text-on-surface-variant">Didn’t receive it? {resendIn ? <span>Resend available in {resendIn}s</span> : <button type="button" onClick={() => void sendCode()} className="font-semibold text-primary hover:underline">Resend code</button>}</div>
          <button type="button" onClick={() => { setStep("email"); setError(null); setCode("") }} className="mt-4 w-full text-sm font-medium text-on-surface-variant hover:text-primary">Use a different email address</button>
        </>}
        <footer className="mt-8 border-t border-outline-variant pt-6 text-center"><Link href="/auth/login" className="text-sm font-semibold text-primary hover:underline">Back to login</Link></footer>
      </section>
    </main>
  </div>
}

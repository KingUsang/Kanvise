"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getBrowserAppUrl } from "@/config/app"
import { AuthAlert, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { signUpErrorMessage } from '@/lib/auth-error-message'

type Invite = { email: string; school_name: string; expires_at: string }

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const supabase = useMemo(() => createClient(), [])
  const [invite, setInvite] = useState<Invite | null>(null)
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    async function load() {
      if (!token) {
        if (live) { setError("This invitation link is missing its secure code."); setLoading(false) }
        return
      }
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/tutor-invite/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_token: token }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok || !body?.data) throw new Error('invitation_unavailable')
        const { data: { user } } = await supabase.auth.getUser()
        if (!live) return
        setInvite(body.data)
        setFullName(`${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim())
        setSignedInEmail(user?.email?.toLowerCase() || null)
      } catch {
        if (live) setError("This invitation link isn't valid. Check that you copied the full link, or ask the person who invited you to send another.")
      } finally {
        if (live) setLoading(false)
      }
    }
    void load()
    return () => { live = false }
  }, [supabase, token])

  const completeExistingAccount = async () => {
    if (!invite || !token) return
    const { firstName, lastName } = splitFullName(fullName)
    if (!firstName || !lastName) { setError('Enter your full name.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('session_unavailable')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ flow: "tutor", first_name: firstName, last_name: lastName, invite_token: token }),
      })
      if (!response.ok) throw new Error('invitation_completion_failed')
      await supabase.auth.refreshSession()
      window.location.assign("/dashboard")
    } catch (acceptError) {
      setError(acceptError instanceof Error && acceptError.message === 'session_unavailable'
        ? 'Please sign in again to accept this invitation.'
        : "We couldn't finish accepting this invitation right now. Try again.")
      setSubmitting(false)
    }
  }

  const register = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!invite || !token) return
    const { firstName, lastName } = splitFullName(fullName)
    if (!firstName || !lastName) { setError('Enter your full name.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const redirectTo = `${getBrowserAppUrl()}/api/auth/callback?role=tutor&invite_token=${encodeURIComponent(token)}`
      const { error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { emailRedirectTo: redirectTo, data: { first_name: firstName, last_name: lastName } },
      })
      if (signUpError) {
        setError(signUpErrorMessage(signUpError))
        return
      }
      setSuccess(true)
    } catch {
      setError("We couldn't create your account right now. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    window.location.reload()
  }

  const loginHref = token ? `/auth/login?redirect=${encodeURIComponent(`/join?token=${encodeURIComponent(token)}`)}` : "/auth/login"

  const names = splitFullName(fullName)
  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
      <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
      {loading ? <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-[#625e6e]"><Loader2 className="animate-spin" size={19}/>Opening your invitation…</div> : error && !invite ? <div className="py-6 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Invitation unavailable</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">{error}</p><Link href="/auth/login" className="mt-7 flex min-h-12 items-center justify-center rounded-xl bg-[#994704] text-sm font-semibold text-white">Back to sign in</Link></div> : invite && success ? <div className="py-6 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Check your email</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">We sent a verification link to <span className="font-medium text-[#302c39]">{invite.email}</span>. Open it to join {invite.school_name}.</p></div> : invite ? <>
        <header className="mb-7 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Join {invite.school_name}</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">Continue with the email address that received this invitation.</p><p className="mt-2 break-all text-sm font-medium text-[#302c39]">{invite.email}</p></header>
        {error && <AuthAlert>{error}</AuthAlert>}
        {signedInEmail ? signedInEmail === invite.email.toLowerCase() ? <div className="space-y-5"><Field id="full-name" label="Full name" value={fullName} onChange={setFullName} placeholder="John Doe"/><button type="button" onClick={() => void completeExistingAccount()} disabled={submitting || !names.firstName || !names.lastName} className={authPrimaryButtonClass}>{submitting ? <><Loader2 className="animate-spin" size={18}/>Joining…</> : <>Accept invitation<ArrowRight size={16}/></>}</button><button type="button" onClick={() => void signOut()} className="w-full text-sm font-medium text-[#2e2877] hover:underline">Use a different account</button></div> : <div><p className="mb-5 text-sm leading-6 text-[#625e6e]">You’re signed in as <span className="font-medium text-[#302c39]">{signedInEmail}</span>. This invitation belongs to <span className="font-medium text-[#302c39]">{invite.email}</span>.</p><button type="button" onClick={() => void signOut()} className={authPrimaryButtonClass}>Switch account<ArrowRight size={16}/></button></div> : <form onSubmit={register} className="space-y-5"><Field id="full-name" label="Full name" value={fullName} onChange={setFullName} placeholder="John Doe"/><div><label className="mb-2 block text-sm font-medium text-[#302c39]" htmlFor="password">Create password</label><div className="relative"><input id="password" required minLength={8} pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Use at least 8 characters, one uppercase letter, and one number" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} className={`${authInputClass} pr-12`}/><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#777382] hover:bg-[#f2f0f7]" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><p className="mt-2 text-xs leading-5 text-[#716d78]">At least 8 characters, one uppercase letter, and one number.</p></div><button type="submit" disabled={submitting} className={authPrimaryButtonClass}>{submitting ? <><Loader2 className="animate-spin" size={18}/>Creating account…</> : <>Create account<ArrowRight size={16}/></>}</button></form>}
        {!signedInEmail && <p className="mt-7 border-t border-[#e8e6ec] pt-5 text-center text-sm text-[#625e6e]">Already have an account? <Link href={loginHref} className="font-medium text-[#2e2877] hover:underline">Sign in</Link></p>}
      </> : null}
    </section>
  </main>
}

function splitFullName(value: string) { const parts = value.trim().split(/\s+/); return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' } }
function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div><label className="mb-2 block text-sm font-medium text-[#302c39]" htmlFor={id}>{label}</label><input id={id} required value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={authInputClass}/></div>
}

export default function JoinPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><JoinContent /></Suspense>
}

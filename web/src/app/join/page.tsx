"use client"

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getBrowserAppUrl } from "@/config/app"

type Invite = { email: string; school_name: string; expires_at: string }

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const supabase = useMemo(() => createClient(), [])
  const [invite, setInvite] = useState<Invite | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
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
        if (!response.ok || !body?.data) throw new Error(body?.error || "This invitation is no longer valid.")
        const { data: { user } } = await supabase.auth.getUser()
        if (!live) return
        setInvite(body.data)
        setFirstName(user?.user_metadata?.first_name || "")
        setLastName(user?.user_metadata?.last_name || "")
        setSignedInEmail(user?.email?.toLowerCase() || null)
      } catch (inviteError) {
        if (live) setError(inviteError instanceof Error ? inviteError.message : "We could not open this invitation.")
      } finally {
        if (live) setLoading(false)
      }
    }
    void load()
    return () => { live = false }
  }, [supabase, token])

  const completeExistingAccount = async () => {
    if (!invite || !token) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Please sign in again to accept this invitation.")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ flow: "tutor", first_name: firstName, last_name: lastName, invite_token: token }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "We could not accept this invitation.")
      await supabase.auth.refreshSession()
      window.location.assign("/dashboard")
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "We could not accept this invitation.")
      setSubmitting(false)
    }
  }

  const register = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!invite || !token) return
    setSubmitting(true)
    setError(null)
    try {
      const redirectTo = `${getBrowserAppUrl()}/api/auth/callback?role=tutor&invite_token=${encodeURIComponent(token)}`
      const { error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { emailRedirectTo: redirectTo, data: { first_name: firstName, last_name: lastName } },
      })
      if (signUpError) throw signUpError
      setSuccess(true)
    } catch (signUpError) {
      setError(signUpError instanceof Error && signUpError.message ? signUpError.message : "We could not create your account. Please try again.")
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

  return <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 text-[#1b1c1c] sm:flex sm:items-center sm:justify-center">
    <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10">
      <Link href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-[#2e2877]">Kanvise</Link>
      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#2e2877]" size={28} /></div> : error && !invite ? <>
        <header className="mb-8 text-center"><h1 className="text-3xl font-bold text-[#2e2877]">Invitation unavailable</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">{error}</p></header>
        <Link href="/auth/login" className="block rounded-lg bg-[#994704] px-6 py-4 text-center font-bold text-white">Back to login</Link>
      </> : invite && success ? <>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5e9] text-[#2e7d32]"><CheckCircle2 size={28} /></div>
        <header className="mb-8 text-center"><h1 className="text-3xl font-bold text-[#2e2877]">Check your email</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">We sent a verification link to <strong className="text-[#1b1c1c]">{invite.email}</strong>. Open it to join {invite.school_name}.</p></header>
      </> : invite && <>
        <header className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Tutor invitation</p><h1 className="mt-2 text-3xl font-bold text-[#2e2877]">Join {invite.school_name}</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">This invitation is reserved for the email address below. It cannot be accepted by another account.</p></header>
        <div className="mb-6 rounded-lg border border-[#d9d5ee] bg-[#f5f3ff] p-4"><div className="flex items-start gap-3"><Mail className="mt-0.5 shrink-0 text-[#2e2877]" size={18} /><div><p className="text-xs font-bold uppercase tracking-wider text-[#5e5a7e]">Invited email</p><p className="mt-1 break-all font-semibold text-[#2e2877]">{invite.email}</p></div></div></div>
        {error && <div role="alert" className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        {signedInEmail ? signedInEmail === invite.email.toLowerCase() ? <>
          <p className="mb-5 text-sm text-[#6a6874]">You are signed in as <strong className="text-[#1b1c1c]">{signedInEmail}</strong>. Continue to accept this tutor invitation.</p>
          <button type="button" onClick={() => void completeExistingAccount()} disabled={submitting || !firstName || !lastName} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white disabled:opacity-70">{submitting && <Loader2 className="animate-spin" size={18} />}{submitting ? "Joining centre…" : "Accept invitation"}</button>
          <button type="button" onClick={() => void signOut()} className="mt-4 w-full text-sm font-semibold text-[#2e2877] hover:underline">Use a different account</button>
        </> : <><p className="mb-5 text-sm leading-6 text-[#6a6874]">You are signed in as <strong className="text-[#1b1c1c]">{signedInEmail}</strong>, but this invitation was sent to <strong className="text-[#1b1c1c]">{invite.email}</strong>.</p><button type="button" onClick={() => void signOut()} className="flex w-full items-center justify-center rounded-lg bg-[#994704] py-4 font-bold text-white">Sign out and use invited email</button></> : <form onSubmit={register} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2"><Field id="first-name" label="First name" icon={<UserRound size={18} />} value={firstName} onChange={setFirstName} placeholder="John" /><Field id="last-name" label="Last name" icon={<UserRound size={18} />} value={lastName} onChange={setLastName} placeholder="Doe" /></div>
          <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]" htmlFor="password">Create password</label><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" size={18} /><input id="password" required minLength={8} pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Use at least 8 characters, one uppercase letter, and one number" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="w-full rounded-lg border border-[#c8c5d2] py-3.5 pl-11 pr-12 outline-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p className="mt-1.5 text-[11px] text-[#6a6874]">At least 8 characters, one uppercase letter, and one number.</p></div>
          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white disabled:opacity-70">{submitting && <Loader2 className="animate-spin" size={18} />}{submitting ? "Creating account…" : "Create tutor account"}</button>
        </form>}
        {!signedInEmail && <p className="mt-8 border-t border-[#e4e2e1] pt-6 text-center text-sm text-[#6a6874]">Already have a Kanvise account? <Link href={loginHref} className="font-semibold text-[#2e2877] hover:underline">Sign in with {invite.email}</Link></p>}
      </>}
    </section>
  </main>
}

function Field({ id, label, icon, value, onChange, placeholder }: { id: string; label: string; icon: ReactNode; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]" htmlFor={id}>{label}</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]">{icon}</span><input id={id} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-[#c8c5d2] py-3.5 pl-11 pr-4 outline-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" /></div></div>
}

export default function JoinPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><JoinContent /></Suspense>
}

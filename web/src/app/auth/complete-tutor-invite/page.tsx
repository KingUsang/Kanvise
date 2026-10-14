"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthAlert, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { passwordUpdateErrorMessage } from '@/lib/auth-error-message'

function CompleteTutorInviteContent() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite_token")
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void supabase.auth.getUser().then((result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const user = result.data.user
      const userError = result.error
      if (!live) return
      if (userError || !user?.email || !inviteToken) {
        setError("This invitation session has expired. Ask your administrator to send a new invitation.")
      } else {
        setEmail(user.email)
        setFullName(`${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim())
      }
      setLoading(false)
    })
    return () => { live = false }
  }, [inviteToken, supabase])

  async function finish(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteToken) return
    const parts = fullName.trim().split(/\s+/), firstName = parts.slice(0, -1).join(' '), lastName = parts.at(-1) || ''
    if (!firstName || !lastName) { setError('Enter your full name.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password, data: { first_name: firstName, last_name: lastName } })
      if (updateError) {
        setError(passwordUpdateErrorMessage(updateError))
        setSubmitting(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('session_unavailable')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ flow: "tutor", first_name: firstName, last_name: lastName, invite_token: inviteToken }),
      })
      if (!response.ok) throw new Error('profile_initialisation_failed')
      await supabase.auth.refreshSession()
      window.location.assign("/dashboard")
    } catch {
      setError("We couldn't finish setting up your account. Try again.")
      setSubmitting(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8"><section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12"><Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>{loading ? <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-[#625e6e]"><Loader2 className="animate-spin" size={19}/>Opening your invitation…</div> : error && !email ? <div className="py-6 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Invitation unavailable</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">{error}</p></div> : <><header className="mb-7 text-center"><h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Finish your account</h1><p className="mt-3 text-sm leading-6 text-[#625e6e]">Set a password to join your tutorial agency.</p><p className="mt-2 break-all text-sm font-medium text-[#302c39]">{email}</p></header>{error && <AuthAlert>{error}</AuthAlert>}<form onSubmit={finish} className="space-y-5"><Field id="full-name" label="Full name" value={fullName} onChange={setFullName} placeholder="John Doe" /><div><label className="mb-2 block text-sm font-medium text-[#302c39]" htmlFor="password">Create password</label><div className="relative"><input id="password" required minLength={8} pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Use at least 8 characters, one uppercase letter, and one number" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${authInputClass} pr-12`} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#777382] hover:bg-[#f2f0f7]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p className="mt-2 text-xs leading-5 text-[#716d78]">At least 8 characters, one uppercase letter, and one number.</p></div><button type="submit" disabled={submitting} className={authPrimaryButtonClass}>{submitting ? <><Loader2 className="animate-spin" size={18}/>Setting up account…</> : <>Join tutorial agency<ArrowRight size={16}/></>}</button></form></>}</section></main>
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <div><label className="mb-2 block text-sm font-medium text-[#302c39]" htmlFor={id}>{label}</label><input id={id} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={authInputClass} /></div> }

export default function CompleteTutorInvitePage() { return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><CompleteTutorInviteContent /></Suspense> }

"use client"

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

function CompleteTutorInviteContent() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite_token")
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (!live) return
      if (userError || !user?.email || !inviteToken) {
        setError("This invitation session has expired. Ask your administrator to send a new invitation.")
      } else {
        setEmail(user.email)
        setFirstName(user.user_metadata?.first_name || "")
        setLastName(user.user_metadata?.last_name || "")
      }
      setLoading(false)
    })
    return () => { live = false }
  }, [inviteToken, supabase])

  async function finish(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteToken) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password, data: { first_name: firstName, last_name: lastName } })
      if (updateError) throw updateError
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Your invitation session could not be started. Please open the invitation again.")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ flow: "tutor", first_name: firstName, last_name: lastName, invite_token: inviteToken }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "Your account could not be completed.")
      await supabase.auth.refreshSession()
      window.location.assign("/dashboard")
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Your account could not be completed.")
      setSubmitting(false)
    }
  }

  return <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 text-[#1b1c1c] sm:flex sm:items-center sm:justify-center"><section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10"><Link href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-[#2e2877]">Kanvise</Link>{loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#2e2877]" size={28} /></div> : error && !email ? <><h1 className="text-3xl font-bold text-[#2e2877]">Invitation unavailable</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">{error}</p></> : <><header className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Tutor invitation</p><h1 className="mt-2 text-3xl font-bold text-[#2e2877]">Finish your account</h1><p className="mt-3 text-sm leading-6 text-[#6a6874]">Your email is verified. Set a password to join your tutorial centre.</p></header><div className="mb-6 rounded-lg border border-[#d9d5ee] bg-[#f5f3ff] p-4"><div className="flex gap-3"><Mail className="mt-0.5 shrink-0 text-[#2e2877]" size={18} /><div><p className="text-xs font-bold uppercase tracking-wider text-[#5e5a7e]">Verified invited email</p><p className="mt-1 break-all font-semibold text-[#2e2877]">{email}</p></div></div></div>{error && <p role="alert" className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</p>}<form onSubmit={finish} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field id="first-name" label="First name" icon={<UserRound size={18} />} value={firstName} onChange={setFirstName} placeholder="John" /><Field id="last-name" label="Last name" icon={<UserRound size={18} />} value={lastName} onChange={setLastName} placeholder="Doe" /></div><div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]" htmlFor="password">Create password</label><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" size={18} /><input id="password" required minLength={8} pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Use at least 8 characters, one uppercase letter, and one number" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="w-full rounded-lg border border-[#c8c5d2] py-3.5 pl-11 pr-12 outline-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p className="mt-1.5 text-[11px] text-[#6a6874]">At least 8 characters, one uppercase letter, and one number.</p></div><button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white disabled:opacity-70">{submitting && <Loader2 className="animate-spin" size={18} />}{submitting ? "Setting up account…" : "Join tutorial centre"}</button></form></>}</section></main>
}

function Field({ id, label, icon, value, onChange, placeholder }: { id: string; label: string; icon: ReactNode; value: string; onChange: (value: string) => void; placeholder: string }) { return <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]" htmlFor={id}>{label}</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]">{icon}</span><input id={id} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-[#c8c5d2] py-3.5 pl-11 pr-4 outline-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" /></div></div> }

export default function CompleteTutorInvitePage() { return <Suspense fallback={<main className="min-h-screen bg-[#f7f5f3]" />}><CompleteTutorInviteContent /></Suspense> }

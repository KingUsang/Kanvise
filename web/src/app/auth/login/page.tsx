"use client";

import { useState, Suspense, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getApiUrl } from '@/config/api'
import { postAuthDestination, studentRegisterHref, type KanviseRole } from '@/lib/auth-continuation'
import { createStudentRegistrationIntent } from '@/lib/student-registration'
import { AuthMethodDivider, GoogleAuthButton } from '@/components/auth/google-auth-button'
import { AuthAlert, AuthHeading, AuthLabel, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { signInErrorMessage } from '@/lib/auth-error-message'

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = safeRedirectPath(searchParams.get("redirect"));
  const reason = searchParams.get("reason");
  const flow = searchParams.get('flow') === 'student' ? 'student' : 'centre'
  const registrationIntent = searchParams.get('intent')
  const registerHref = flow === 'student'
    ? studentRegisterHref({ redirect: redirectParams, intent: registrationIntent })
    : redirectParams ? `/auth/register?redirect=${encodeURIComponent(redirectParams)}` : '/auth/register'
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false)

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInErrorMessage(signInError));
      setLoading(false);
      return;
    }

    try {
      if (!signInData.session?.access_token) throw new Error('Your session could not be started')
      // Existing accounts created before trusted role claims were introduced
      // need one profile resolution before routing. The API backfills the
      // server-controlled claims from the canonical profile; refreshing here
      // prevents the web middleware from treating that account as a student.
      const profileResponse = await fetch(`${getApiUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${signInData.session.access_token}` },
      })
      const profileBody = await profileResponse.json()
      if (!profileResponse.ok || !profileBody.user?.role) throw new Error(profileBody.error || 'Could not load your account')
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed.session) throw refreshError || new Error('Your session could not be refreshed')
      window.location.assign(postAuthDestination({
        role: profileBody.user.role as KanviseRole,
        schoolId: profileBody.user.school_id,
        redirect: redirectParams,
      }))
    } catch {
      setError("You're signed in, but Kanvise couldn't finish loading your account. Try again.")
      setLoading(false)
    }
  };

  const handleRegister = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (flow !== 'student' || registrationIntent || !redirectParams) return
    event.preventDefault()
    setRegisterLoading(true)
    setError(null)
    try {
      const intent = await createStudentRegistrationIntent(redirectParams)
      router.push(studentRegisterHref({ redirect: redirectParams, intent }))
    } catch {
      setError("We couldn't start your class registration right now. Try again.")
      setRegisterLoading(false)
    }
  }

  const googleHref = `/api/auth/google?intent=${flow === 'student' ? 'student' : 'login'}${redirectParams ? `&return_to=${encodeURIComponent(redirectParams)}` : ''}${registrationIntent ? `&registration_intent=${encodeURIComponent(registrationIntent)}` : ''}`
  const handleGoogle = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (flow !== 'student' || registrationIntent) return
    event.preventDefault(); setLoading(true); setError(null)
    try {
      if (!redirectParams) throw new Error('Open the class or mock you want to join, then continue with Google.')
      const intent = await createStudentRegistrationIntent(redirectParams)
      window.location.assign(`/api/auth/google?intent=student&return_to=${encodeURIComponent(redirectParams)}&registration_intent=${encodeURIComponent(intent)}`)
    } catch { setError("We couldn't start Google sign-in right now. Try again."); setLoading(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
      <div className="mx-auto w-full max-w-[404px]">
          <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center">
            <img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" />
          </Link>
      <div className="text-center [&_p]:mx-auto">
        <AuthHeading title="Welcome back to Kanvise" description={flow === 'student' ? 'Sign in to continue joining your class.' : 'Sign in to continue to Kanvise.'} />
      </div>
      {reason === 'session_expired' ? <AuthAlert tone="info">Your session has expired. Sign in to continue.</AuthAlert> : null}
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <GoogleAuthButton href={googleHref} onClick={handleGoogle} label="Continue with Google" />
      <AuthMethodDivider />
      <form onSubmit={handleLogin} className="space-y-5">
        <div><AuthLabel htmlFor="email">Email address</AuthLabel><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b8796]" size={18}/><input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={`${authInputClass} pl-11`} placeholder="you@example.com" /></div></div>
        <div><AuthLabel htmlFor="password">Password</AuthLabel><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b8796]" size={18}/><input id="password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={`${authInputClass} pl-11 pr-12`} placeholder="Enter your password"/><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#777382] hover:bg-[#f2f0f7] hover:text-[#2e2877]" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
        <button type="submit" disabled={loading} className={authPrimaryButtonClass}>{loading ? <><Loader2 className="animate-spin" size={18}/>Signing in…</> : <>Sign in<ArrowRight size={16}/></>}</button>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e5ee] pt-5 text-sm">
        <Link href="/auth/forgot-password" className="font-semibold text-[#2e2877] hover:underline">Forgot password?</Link>
        <Link href={registerHref} onClick={handleRegister} aria-disabled={registerLoading} className="font-semibold text-[#2e2877] hover:underline">{registerLoading ? 'Preparing…' : 'Create an account'}</Link>
      </div>
      </div>
    </section>
  </main>
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-kv-bg"><Loader2 className="w-8 h-8 animate-spin text-kv-blue" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

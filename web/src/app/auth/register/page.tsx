"use client";

import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Check, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from '@/lib/safe-redirect'
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PASSWORD_REQUIREMENTS } from '@/lib/password-policy'
import { loginHref as buildLoginHref, postAuthDestination } from '@/lib/auth-continuation'
import { getApiUrl } from '@/config/api'
import { AuthMethodDivider, GoogleAuthButton } from '@/components/auth/google-auth-button'
import { AuthAlert, AuthHeading, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { VerificationCodeInput } from '@/components/auth/verification-code-input'
import { recoveryRequestErrorMessage, signUpErrorMessage, verificationErrorMessage } from '@/lib/auth-error-message'
import { maskEmail } from '@/lib/mask-email'

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/)
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' }
}

function RegisterContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Public enrolment starts here with `return_to`; Login uses `redirect`.
  // Accept both so switching between the two forms never loses the programme
  // page the student intended to return to.
  const redirectParam = safeRedirectPath(searchParams.get("return_to") || searchParams.get("redirect"));
  const isStudentFlow = pathname.endsWith('/student');
  const [accountType, setAccountType] = useState<'independent' | 'centre'>('independent');
  const flow = isStudentFlow ? 'student' : accountType === 'independent' ? 'independent' : 'centre';
  const studentRegistrationToken = searchParams.get('intent');
  const studentFlowHasContext = Boolean(studentRegistrationToken)
  const loginHref = buildLoginHref({
    redirect: redirectParam,
    flow: isStudentFlow ? 'student' : 'centre',
    intent: studentRegistrationToken,
  });
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [centreName, setCentreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCodeStep, setIsCodeStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCodeStep || resendSeconds <= 0) return
    const timer = window.setTimeout(() => setResendSeconds(seconds => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [isCodeStep, resendSeconds])

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    const { firstName, lastName } = splitFullName(fullName)
    if (!firstName || !lastName) {
      setError("Enter your full name"); return;
    }
    if (!isStudentFlow && accountType === 'centre' && !centreName.trim()) {
      setError("Enter your tutorial agency name"); return;
    }
    setLoading(true);
    setError(null);

    try {
      const normalisedEmail = email.trim().toLowerCase()

      // Someone following a student offer may already use Kanvise. When their
      // password is correct, continue the existing identity immediately.
      if (isStudentFlow) {
        const { data: existingSignIn, error: existingSignInError } = await supabase.auth.signInWithPassword({
          email: normalisedEmail,
          password,
        })
        if (existingSignIn.session?.access_token) {
          const profileResponse = await fetch(`${getApiUrl()}/auth/me`, {
            headers: { Authorization: `Bearer ${existingSignIn.session.access_token}` },
          })
          const profileBody = await profileResponse.json().catch(() => null)
          if (!profileResponse.ok) throw new Error(profileBody?.error || 'Could not load your existing account')
          if (profileBody?.user?.role !== 'student') {
            await supabase.auth.signOut()
            throw new Error('This email belongs to a staff account. Use a student email to continue.')
          }
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError || !refreshed.session) throw refreshError || new Error('Your session could not be refreshed')
          window.location.assign(postAuthDestination({ role: 'student', redirect: redirectParam }))
          return
        }
        if (existingSignInError && !['invalid_credentials', 'email_not_confirmed'].includes(existingSignInError.code || '')) {
          throw existingSignInError
        }
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalisedEmail,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            ...(!isStudentFlow && accountType === 'centre' && { centre_name: centreName.trim() }),
          },
        },
      });

      if (signUpError) throw signUpError
      // Supabase deliberately obscures an existing confirmed account when
      // email confirmation is enabled. Do not leave that person waiting for a
      // verification email that will not be sent.
      if (signUpData?.user && signUpData.user.identities?.length === 0) {
        setError('An account already uses this email. Log in with its password, or reset the password if you have forgotten it.')
        return
      }
      setIsCodeStep(true)
      setResendSeconds(60)
    } catch (signUpError) {
      setError(signUpErrorMessage(signUpError as { code?: string; message?: string }))
    } finally {
      setLoading(false)
    }
  };

  const finishRegistration = async (accessToken: string, userEmail: string) => {
    const { firstName, lastName } = splitFullName(fullName)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) throw new Error("Account setup is temporarily unavailable");

    const response = await fetch(`${apiUrl}/auth/profile/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ flow, student_registration_token: studentRegistrationToken, first_name: firstName, last_name: lastName, email: userEmail }),
    });

    if (!response.ok) throw new Error('profile_initialisation_failed')

    // profile/init updates the trusted role claims server-side. Refresh before
    // navigating so middleware and server layouts do not evaluate the new user
    // with the pre-initialisation JWT (or a stale session from another account
    // previously used in this browser).
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      throw new Error("Your account was created, but the dashboard session could not be refreshed. Please sign in again.");
    }

    if (flow === "centre" || flow === 'independent') {
      const centreResponse = await fetch(`${apiUrl}/schools`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshed.session.access_token}`,
        },
        body: JSON.stringify({ name: flow === 'independent' ? `${firstName.trim()} ${lastName.trim()}`.trim() : centreName.trim(), account_type: flow === 'independent' ? 'independent' : 'centre' }),
      });
      const centreBody = await centreResponse.json().catch(() => null);
      if (!centreResponse.ok && centreBody?.code !== "SCHOOL_ALREADY_CONFIGURED") {
        throw new Error(centreBody?.error || "Your account was created, but your tutorial agency could not be set up");
      }

      // Centre creation updates trusted app_metadata; refresh before the
      // dashboard middleware evaluates school access.
      const { data: centreSession, error: centreRefreshError } = await supabase.auth.refreshSession();
      if (centreRefreshError || !centreSession.session?.user.app_metadata?.school_id) {
        throw new Error("Your tutorial agency was created, but the dashboard session could not be refreshed. Please sign in again.");
      }
    }

    const destination = flow === "centre" || flow === 'independent' ? "/dashboard" : redirectParam || "/dashboard/student";
    window.location.assign(destination);
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the six-digit code from your email");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: "signup",
      });
      if (verifyError) {
        setError(verificationErrorMessage(verifyError));
        setLoading(false);
        return;
      }
      if (!data.session?.access_token || !data.user?.email) {
        setError("Your email was verified, but Kanvise couldn't finish starting your session. Try again.");
        setLoading(false);
        return;
      }
      await finishRegistration(data.session.access_token, data.user.email);
    } catch {
      setError("Your email was verified, but Kanvise couldn't finish setting up your account. Try again.");
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendSeconds > 0) return
    setResendLoading(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    if (resendError) setError(recoveryRequestErrorMessage(resendError));
    else setResendSeconds(60)
    setResendLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
      <section className="grid w-full max-w-[1120px] overflow-hidden rounded-[20px] border border-[#e1e0e6] bg-white sm:rounded-[24px] lg:grid-cols-[.95fr_1.05fr]">
        <div aria-hidden className="relative hidden min-h-[760px] overflow-hidden border-r border-[#e1e0e6] bg-[#f0eff8] lg:block">
          <img src="/landing/kanvise-ai-performance-concept-v1.png" alt="" className="absolute inset-0 h-full w-full object-cover object-[58%_center]" />
          <div className="absolute inset-0 bg-[#211969]/[.06]" />
        </div>
        <div className="flex items-center justify-center px-5 py-8 sm:px-10 sm:py-11 lg:px-12">
        <div className="mx-auto w-full max-w-[460px]">
          <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>

        {isStudentFlow && !studentFlowHasContext ? <div className="py-6 text-center">
          <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Choose a programme first</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">Student sign-up starts from a programme or invitation link so we can keep your place and access details together.</p>
          <div className="mt-7 space-y-3"><Link href={redirectParam || '/'} className={authPrimaryButtonClass}>Return to programme<ArrowRight size={16}/></Link><Link href="/auth/login" className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#d7d5df] px-5 text-sm font-medium text-[#2e2877] hover:bg-[#fafafa]">Back to sign in</Link></div>
        </div> : !isCodeStep ? (
          <>
            <div className="text-center [&_p]:mx-auto"><AuthHeading title={isStudentFlow ? 'Create account' : 'Get started with Kanvise'} description={isStudentFlow ? 'Create an account to continue joining your programme.' : 'Set up your space for smarter tutoring.'} /></div>

            {error && <AuthAlert>{error}</AuthAlert>}

            {!isStudentFlow && <fieldset className="mb-6" aria-label="Account type"><legend className="mb-2.5 text-sm font-medium text-[#302c39]">Account type</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#dedce5] bg-[#f6f6f8] p-1">
              <button type="button" onClick={() => setAccountType('independent')} aria-pressed={accountType === 'independent'} className={`min-h-11 rounded-lg px-3 text-sm font-medium transition ${accountType === 'independent' ? 'bg-white text-[#211969] shadow-[0_1px_4px_rgba(27,28,28,.10)]' : 'text-[#696572] hover:text-[#2e2877]'}`}>Independent tutor</button>
              <button type="button" onClick={() => setAccountType('centre')} aria-pressed={accountType === 'centre'} className={`min-h-11 rounded-lg px-3 text-sm font-medium transition ${accountType === 'centre' ? 'bg-white text-[#211969] shadow-[0_1px_4px_rgba(27,28,28,.10)]' : 'text-[#696572] hover:text-[#2e2877]'}`}>Tutorial agency</button>
              </div>
              <p className="mt-3 text-sm leading-5 text-[#625e6e]">{accountType === 'independent' ? 'For tutors managing their own students and classes.' : 'For teams managing tutors, programmes and students.'}</p>
            </fieldset>}
            <GoogleAuthButton href={`/api/auth/google?intent=${isStudentFlow ? 'student' : 'educator'}${!isStudentFlow ? `&account_type=${accountType}` : ''}${redirectParam ? `&return_to=${encodeURIComponent(redirectParam)}` : ''}${studentRegistrationToken ? `&registration_intent=${encodeURIComponent(studentRegistrationToken)}` : ''}`} />
            <AuthMethodDivider />

            <form onSubmit={handleRegister} className="space-y-5">
              {!isStudentFlow && accountType === 'centre' && <Field label="Tutorial agency name" icon={<Building2 size={18} />} value={centreName} onChange={setCentreName} placeholder="Bright Future Tutorials" />}
              <Field label="Full name" icon={<User size={18} />} value={fullName} onChange={setFullName} placeholder="John Doe" />
              <Field label="Email address" icon={<Mail size={18} />} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#302c39]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" size={18} />
                  <input id="password" type={showPassword ? "text" : "password"} required minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a secure password" className={`${authInputClass} pl-11 pr-12`} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b98a3] hover:text-[#2e2877]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#6a6874]">{PASSWORD_REQUIREMENTS}</p>
              </div>
              <button type="submit" disabled={loading} className={authPrimaryButtonClass}>{loading ? <><Loader2 className="animate-spin" size={18}/>Creating account…</> : <>Create account<ArrowRight size={16}/></>}</button>
            </form>
          </>
        ) : (
          <>
            <header className="mb-7 text-center">
              <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Verify your email</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">Enter the six-digit code sent to <span className="font-medium text-[#302c39]">{maskEmail(email)}</span>.</p>
            </header>

            {error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <VerificationCodeInput id="verification-code" label="Verification code" value={verificationCode} onChange={setVerificationCode} disabled={loading} />
              <button type="submit" disabled={loading} className={authPrimaryButtonClass}>{loading ? <><Loader2 className="animate-spin" size={18}/>Verifying…</> : <>Verify email<Check size={16}/></>}</button>
            </form>

            <div className="mt-6 flex flex-col gap-3 text-center text-sm">
              <button type="button" onClick={() => void handleResendCode()} disabled={resendLoading || resendSeconds > 0} className="font-semibold text-[#2e2877] hover:underline disabled:cursor-not-allowed disabled:text-[#8b8794] disabled:no-underline">{resendLoading ? "Sending…" : resendSeconds > 0 ? `Resend code in 0:${String(resendSeconds).padStart(2, '0')}` : "Resend code"}</button>
              <button type="button" onClick={() => { setIsCodeStep(false); setVerificationCode(''); setError(null) }} className="text-[#6a6874] hover:text-[#2e2877] hover:underline">Use a different email</button>
            </div>
          </>
        )}

        {!isCodeStep && (!isStudentFlow || studentFlowHasContext) && <p className="mt-7 border-t border-[#e8e6ec] pt-5 text-center text-sm text-[#6a6874]">Already have an account? <Link href={loginHref} className="font-semibold text-[#2e2877] hover:underline">Sign in</Link></p>}
        </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, icon, type = "text", value, onChange, placeholder }: { label: string; icon: ReactNode; type?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const fieldId = `registration-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium text-[#302c39]">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]">{icon}</span>
        <input id={fieldId} type={type} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${authInputClass} pl-11`} />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterContent /></Suspense>;
}

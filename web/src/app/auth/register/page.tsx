"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const isStudentFlow = Boolean(redirectParam);
  const role = isStudentFlow ? "student" : "admin";
  const supabase = createClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCodeStep, setIsCodeStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setIsCodeStep(true);
    }
    setLoading(false);
  };

  const finishRegistration = async (accessToken: string, userEmail: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) throw new Error("Account setup is temporarily unavailable");

    const response = await fetch(`${apiUrl}/auth/profile/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ role, first_name: firstName, last_name: lastName, email: userEmail }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Your email was verified, but account setup could not be completed");
    }

    // profile/init updates the trusted role claims server-side. Refresh before
    // navigating so middleware and server layouts do not evaluate the new user
    // with the pre-initialisation JWT (or a stale session from another account
    // previously used in this browser).
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      throw new Error("Your account was created, but the dashboard session could not be refreshed. Please sign in again.");
    }

    const destination = role === "admin"
      ? "/dashboard/school-setup"
      : redirectParam || "/dashboard/student";
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
      if (verifyError) throw verifyError;
      if (!data.session?.access_token || !data.user?.email) throw new Error("Verification succeeded, but no session was returned");
      await finishRegistration(data.session.access_token, data.user.email);
    } catch (verificationError: any) {
      setError(verificationError.message || "That code is invalid or has expired");
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    if (resendError) setError(resendError.message);
    setResendLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 text-[#1b1c1c] sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-[#2e2877]">Kanvise</Link>

        {!isCodeStep ? (
          <>
            <header className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Create account</p>
              <h1 className="mt-2 text-3xl font-bold text-[#2e2877]">{isStudentFlow ? "Join your programme" : "Set up your school"}</h1>
              <p className="mt-3 text-sm leading-6 text-[#6a6874]">Use your email and password to create your Kanvise account.</p>
            </header>

            {error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="First name" icon={<User size={18} />} value={firstName} onChange={setFirstName} placeholder="John" />
                <Field label="Last name" icon={<User size={18} />} value={lastName} onChange={setLastName} placeholder="Doe" />
              </div>
              <Field label="Email address" icon={<Mail size={18} />} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" size={18} />
                  <input id="password" type={showPassword ? "text" : "password"} required minLength={8} pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Use at least 8 characters, one uppercase letter, and one number" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="w-full rounded-lg border border-[#c8c5d2] py-3.5 pl-11 pr-12 text-[#1b1c1c] outline-none transition focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b98a3] hover:text-[#2e2877]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#6a6874]">At least 8 characters, one uppercase letter, and one number.</p>
              </div>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white transition hover:bg-[#753400] disabled:opacity-70">{loading && <Loader2 className="animate-spin" size={18} />}{loading ? "Creating account…" : "Create account"}</button>
            </form>
          </>
        ) : (
          <>
            <header className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0edff] text-[#2e2877]"><Mail size={26} /></div>
              <h1 className="text-3xl font-bold text-[#2e2877]">Check your email</h1>
              <p className="mt-3 text-sm leading-6 text-[#6a6874]">Enter the six-digit code sent to <span className="font-semibold text-[#1b1c1c]">{email}</span>.</p>
            </header>

            {error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <label htmlFor="verification-code" className="sr-only">Verification code</label>
              <input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="w-full rounded-lg border border-[#c8c5d2] px-4 py-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white transition hover:bg-[#753400] disabled:opacity-70">{loading && <Loader2 className="animate-spin" size={18} />}{loading ? "Verifying…" : "Verify email"}</button>
            </form>

            <div className="mt-6 flex flex-col gap-3 text-center text-sm">
              <button type="button" onClick={() => void handleResendCode()} disabled={resendLoading} className="font-semibold text-[#2e2877] hover:text-[#994704] disabled:opacity-50">{resendLoading ? "Sending…" : "Send a new code"}</button>
              <Link href="/auth/login" className="text-[#6a6874] hover:text-[#2e2877]">Back to login</Link>
            </div>
          </>
        )}

        {!isCodeStep && <p className="mt-8 border-t border-[#e4e2e1] pt-6 text-center text-sm text-[#6a6874]">Already have an account? <Link href="/auth/login" className="font-semibold text-[#2e2877]">Log in</Link></p>}
      </section>
    </main>
  );
}

function Field({ label, icon, type = "text", value, onChange, placeholder }: { label: string; icon: ReactNode; type?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b98a3]">{icon}</span>
        <input type={type} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-[#c8c5d2] py-3.5 pl-11 pr-4 text-[#1b1c1c] outline-none transition focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877]/30" />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterContent /></Suspense>;
}

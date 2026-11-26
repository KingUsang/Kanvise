"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { meetsPasswordPolicy, passwordChecks } from '@/lib/password-policy';
import { AuthAlert, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { passwordUpdateErrorMessage } from '@/lib/auth-error-message'

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [recoveryVerified, setRecoveryVerified] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then((result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const user = result.data.user
      if (!active) return;
      if (!user) {
        setError("Enter the reset code from your email before choosing a new password.");
      } else {
        setRecoveryVerified(true);
      }
      setCheckingRecovery(false);
    }).catch(() => {
      if (!active) return
      setError("We couldn't check this password reset right now. Request a new recovery code to continue.")
      setCheckingRecovery(false)
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  // Password validation checks
  const { hasMinLength, hasLowercase, hasUppercase, hasNumber } = passwordChecks(password);
  
  const isValid = meetsPasswordPolicy(password) && password === confirmPassword && password !== "";

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryVerified || !isValid) return;

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(passwordUpdateErrorMessage(updateError));
      setLoading(false);
      return;
    }

    // Imported students already have a roster profile and programme enrolment.
    // Their invitation only creates a login, so record that this profile is now
    // active once they have chosen a password.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile/activate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch (activationError) {
      console.error('Could not mark student profile active:', activationError);
    }

    setSuccess(true);
    setLoading(false);
    
    // Automatically redirect to appropriate dashboard based on role
    setTimeout(async () => {
      // The updateUser call usually updates the session, but we can explicitly get the user
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.app_metadata?.kanvise_role || user?.app_metadata?.role;
      
      let redirectUrl = "/";
      if (role === "admin" || role === "tutor") {
        redirectUrl = "/dashboard";
      } else if (role === "student") {
        redirectUrl = "/dashboard/student";
      }
      
      router.push(redirectUrl);
      router.refresh();
    }, 2500);
  };

  const requirements = [
    [hasMinLength, 'At least 8 characters'],
    [hasUppercase, 'One uppercase letter'],
    [hasLowercase, 'One lowercase letter'],
    [hasNumber, 'One number'],
  ] as const

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
      <div className="mx-auto w-full max-w-[404px]">
        <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
        {checkingRecovery ? <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-[#625e6e]"><Loader2 className="h-5 w-5 animate-spin"/>Checking password reset…</div>
        : success ? <div className="text-center">
          <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Password updated</h1>
          <p className="mt-3 text-sm leading-6 text-[#625e6e]">Your password has been changed.</p>
          <div className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#dedce5] text-sm text-[#625e6e]"><Loader2 className="h-4 w-4 animate-spin"/>Opening your account…</div>
        </div> : !recoveryVerified ? <div className="py-6 text-center">
          <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">This reset link can’t be used</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">This password reset link has expired or is no longer valid. Request a new recovery code to continue.</p>
          <div className="mt-7 space-y-3"><Link href="/auth/forgot-password" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white"><KeyRound aria-hidden size={16}/>Request a new code</Link><button type="button" onClick={() => router.push('/auth/login')} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d7d5df] px-5 text-sm font-medium text-[#2e2877]"><ArrowLeft aria-hidden size={16}/>Back to sign in</button></div>
        </div> : <>
          <header className="mb-7 text-center">
            <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Choose a new password</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">Choose a secure password for your account.</p>
          </header>
          {error && <AuthAlert>{error}</AuthAlert>}
          <form className="space-y-5" onSubmit={handleUpdate}>
            <PasswordField id="new_password" label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(value => !value)} />
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-[#e3e1e8] bg-[#fafafa] p-4 text-xs text-[#716d78]">{requirements.map(([met, label]) => <li key={label} className={`flex items-center gap-2 ${met ? 'text-[#17653a]' : ''}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${met ? 'border-[#17653a] bg-[#17653a] text-white' : 'border-[#aaa6b2]'}`}>{met ? <Check size={11}/> : null}</span>{label}</li>)}</ul>
            <PasswordField id="confirm_password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(value => !value)} />
            {confirmPassword && password !== confirmPassword ? <p className="text-sm text-[#a33a2b]">Passwords do not match.</p> : null}
            <button disabled={!recoveryVerified || checkingRecovery || loading || !isValid} className={authPrimaryButtonClass} type="submit">{loading ? <><Loader2 className="h-5 w-5 animate-spin"/>Updating…</> : <>Update password<Check size={16}/></>}</button>
          </form>
          <button type="button" onClick={() => router.push('/auth/login')} className="mt-6 w-full text-center text-sm font-medium text-[#625e6e] hover:text-[#2e2877] hover:underline">Back to sign in</button>
        </>}
      </div>
    </section>
  </main>
}

function PasswordField({ id, label, value, onChange, visible, onToggle }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-[#302c39]">{label}</label><div className="relative"><input id={id} required autoComplete="new-password" type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} placeholder="Enter your password" className={`${authInputClass} pr-12`}/><button type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#777382] hover:bg-[#f2f0f7]">{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
}

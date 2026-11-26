"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { meetsPasswordPolicy, passwordChecks } from "@/lib/password-policy";
import { AuthAlert, authInputClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'
import { passwordUpdateErrorMessage } from '@/lib/auth-error-message'

export default function AcceptInvitationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [fullName, setFullName] = useState('');
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState({ firstName: "", lastName: "", schoolName: "", programmeName: "" });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then((result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const user = result.data.user
      if (!mounted) return;
      if (!user) {
        setError("Your sign-in didn't finish. Open the invitation again to continue.");
      } else {
        const metadata = user.user_metadata || {};
        setInvitation({
          firstName: String(metadata.first_name || ""),
          lastName: String(metadata.last_name || ""),
          schoolName: String(metadata.school_name || ""),
          programmeName: String(metadata.programme_name || ""),
        });
        setFullName(`${String(metadata.first_name || '')} ${String(metadata.last_name || '')}`.trim())
        setReady(true);
      }
      setChecking(false);
    });
    return () => { mounted = false; };
  }, [supabase]);

  const checks = passwordChecks(password);
  const nameParts = fullName.trim().split(/\s+/), parsedFirstName = nameParts.slice(0, -1).join(' '), parsedLastName = nameParts.at(-1) || ''
  const valid = Boolean(parsedFirstName && parsedLastName) && meetsPasswordPolicy(password) && password === confirmation;

  async function acceptInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const firstName = parsedFirstName;
      const lastName = parsedLastName;
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: { first_name: firstName, last_name: lastName },
      });
      if (passwordError) {
        setError(passwordUpdateErrorMessage(passwordError));
        setSaving(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('session_unavailable');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error('activation_unavailable');
      const response = await fetch(`${apiUrl}/auth/profile/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      if (!response.ok) throw new Error('activation_failed');
      setSuccess(true);
      window.setTimeout(() => window.location.assign("/dashboard/student"), 1800);
    } catch {
      setError("We couldn't finish accepting this invitation right now. Try again.");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
      <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
        <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
        {checking ? (
          <div className="flex items-center justify-center gap-3 py-16 text-[#6a6874]"><Loader2 className="animate-spin" size={20} /> Checking your invitation…</div>
        ) : success ? (
          <div className="py-10 text-center">
            <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Your account is ready</h1>
            <p className="mt-3 text-sm leading-6 text-[#6a6874]">Taking you to your learning dashboard now.</p>
          </div>
        ) : !ready ? (
          <div className="py-8 text-center">
            <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Your sign-in didn’t finish</h1>
            <p className="mt-3 text-sm leading-6 text-[#6a6874]">{error}</p>
            <Link href="/auth/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#994704] px-6 text-sm font-semibold text-white">Back to sign in</Link>
          </div>
        ) : (
          <>
            <header className="mb-7 text-center">
              <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Accept your invitation</h1>
              <p className="mt-3 text-sm leading-6 text-[#6a6874]">
                Create your profile and password{invitation.programmeName ? ` to access ${invitation.programmeName}` : ""}{invitation.schoolName ? ` at ${invitation.schoolName}` : ""}.
              </p>
            </header>
            {error && <AuthAlert>{error}</AuthAlert>}
            <form onSubmit={acceptInvitation} className="space-y-5">
              <TextField id="full-name" label="Full name" value={fullName} autoComplete="name" onChange={setFullName} />
              <PasswordField id="password" label="Create password" value={password} onChange={setPassword} shown={showPassword} onToggle={() => setShowPassword(value => !value)} />
              <div className="rounded-lg border border-[#e4e2e1] bg-[#f9f7f4] p-4 text-sm text-[#6a6874]">
                <p className={checks.hasMinLength ? "text-green-700" : ""}>• At least 8 characters</p>
                <p className={checks.hasLowercase ? "mt-2 text-green-700" : "mt-2"}>• One lowercase letter</p>
                <p className={checks.hasUppercase ? "mt-2 text-green-700" : "mt-2"}>• One uppercase letter</p>
                <p className={checks.hasNumber ? "mt-2 text-green-700" : "mt-2"}>• One number</p>
              </div>
              <PasswordField id="password-confirmation" label="Confirm password" value={confirmation} onChange={setConfirmation} shown={showConfirmation} onToggle={() => setShowConfirmation(value => !value)} />
              {confirmation && password !== confirmation && <p className="text-sm text-red-600">Passwords do not match.</p>}
              <button type="submit" disabled={!valid || saving} className={authPrimaryButtonClass}>
                {saving ? <><Loader2 className="animate-spin" size={18}/>Activating account…</> : <>Accept invitation<ArrowRight size={16}/></>}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function TextField({ id, label, value, autoComplete, onChange }: { id: string; label: string; value: string; autoComplete: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-[#302c39]">{label}</label><input id={id} required autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} className={authInputClass} /></div>;
}

function PasswordField({ id, label, value, onChange, shown, onToggle }: { id: string; label: string; value: string; onChange: (value: string) => void; shown: boolean; onToggle: () => void }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-[#302c39]">{label}</label><div className="relative"><input id={id} required autoComplete="new-password" type={shown ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} className={`${authInputClass} pr-12`} /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#777382] hover:bg-[#f2f0f7]" aria-label={shown ? "Hide password" : "Show password"}>{shown ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>;
}

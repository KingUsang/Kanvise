"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { meetsPasswordPolicy, passwordChecks } from "@/lib/password-policy";

export default function AcceptInvitationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState({ firstName: "", lastName: "", schoolName: "", programmeName: "" });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      if (!user) {
        setError("This invitation link has expired, was already used, or was opened in a different browser.");
      } else {
        const metadata = user.user_metadata || {};
        setInvitation({
          firstName: String(metadata.first_name || ""),
          lastName: String(metadata.last_name || ""),
          schoolName: String(metadata.school_name || ""),
          programmeName: String(metadata.programme_name || ""),
        });
        setReady(true);
      }
      setChecking(false);
    });
    return () => { mounted = false; };
  }, [supabase]);

  const checks = passwordChecks(password);
  const valid = Boolean(invitation.firstName.trim() && invitation.lastName.trim()) && meetsPasswordPolicy(password) && password === confirmation;

  async function acceptInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const firstName = invitation.firstName.trim();
      const lastName = invitation.lastName.trim();
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: { first_name: firstName, last_name: lastName },
      });
      if (passwordError) throw passwordError;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your account session could not be started");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("Account activation is temporarily unavailable");
      const response = await fetch(`${apiUrl}/auth/profile/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Your account could not be activated");
      setSuccess(true);
      window.setTimeout(() => window.location.assign("/dashboard/student"), 1800);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Your invitation could not be accepted");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f3] px-4 py-10 text-[#1b1c1c] sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#e4e2e1] bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="mb-9 block text-center text-2xl font-bold tracking-tight text-[#2e2877]">Kanvise</Link>
        {checking ? (
          <div className="flex items-center justify-center gap-3 py-16 text-[#6a6874]"><Loader2 className="animate-spin" size={20} /> Checking your invitation…</div>
        ) : success ? (
          <div className="py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Invitation accepted</p>
            <h1 className="mt-3 text-3xl font-bold text-[#2e2877]">Your account is ready</h1>
            <p className="mt-3 text-sm leading-6 text-[#6a6874]">Taking you to your learning dashboard now.</p>
          </div>
        ) : !ready ? (
          <div className="py-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Invitation unavailable</p>
            <h1 className="mt-3 text-3xl font-bold text-[#2e2877]">Request a fresh setup email</h1>
            <p className="mt-3 text-sm leading-6 text-[#6a6874]">{error}</p>
            <Link href="/auth/forgot-password" className="mt-7 inline-flex rounded-lg bg-[#994704] px-6 py-3 font-bold text-white">Send me a new setup code</Link>
          </div>
        ) : (
          <>
            <header className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#994704]">Student invitation</p>
              <h1 className="mt-2 text-3xl font-bold text-[#2e2877]">Accept your invitation</h1>
              <p className="mt-3 text-sm leading-6 text-[#6a6874]">
                Create your profile and password{invitation.programmeName ? ` to access ${invitation.programmeName}` : ""}{invitation.schoolName ? ` at ${invitation.schoolName}` : ""}.
              </p>
            </header>
            {error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <form onSubmit={acceptInvitation} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="first-name" label="First name" value={invitation.firstName} autoComplete="given-name" onChange={firstName => setInvitation(current => ({ ...current, firstName }))} />
                <TextField id="last-name" label="Last name" value={invitation.lastName} autoComplete="family-name" onChange={lastName => setInvitation(current => ({ ...current, lastName }))} />
              </div>
              <PasswordField id="password" label="Create password" value={password} onChange={setPassword} shown={showPassword} onToggle={() => setShowPassword(value => !value)} />
              <div className="rounded-lg border border-[#e4e2e1] bg-[#f9f7f4] p-4 text-sm text-[#6a6874]">
                <p className={checks.hasMinLength ? "text-green-700" : ""}>• At least 8 characters</p>
                <p className={checks.hasLowercase ? "mt-2 text-green-700" : "mt-2"}>• One lowercase letter</p>
                <p className={checks.hasUppercase ? "mt-2 text-green-700" : "mt-2"}>• One uppercase letter</p>
                <p className={checks.hasNumber ? "mt-2 text-green-700" : "mt-2"}>• One number</p>
              </div>
              <PasswordField id="password-confirmation" label="Confirm password" value={confirmation} onChange={setConfirmation} shown={showPassword} onToggle={() => setShowPassword(value => !value)} />
              {confirmation && password !== confirmation && <p className="text-sm text-red-600">Passwords do not match.</p>}
              <button type="submit" disabled={!valid || saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#994704] py-4 font-bold text-white disabled:opacity-50">
                {saving && <Loader2 className="animate-spin" size={18} />}{saving ? "Activating account…" : "Accept invitation"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function TextField({ id, label, value, autoComplete, onChange }: { id: string; label: string; value: string; autoComplete: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]">{label}</label><input id={id} required autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-[#c8c5d2] px-4 py-3.5 outline-none focus:border-[#2e2877]" /></div>;
}

function PasswordField({ id, label, value, onChange, shown, onToggle }: { id: string; label: string; value: string; onChange: (value: string) => void; shown: boolean; onToggle: () => void }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#474551]">{label}</label><div className="relative"><input id={id} required autoComplete="new-password" type={shown ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-[#c8c5d2] px-4 py-3.5 pr-12 outline-none focus:border-[#2e2877]" /><button type="button" onClick={onToggle} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b98a3]" aria-label={shown ? "Hide password" : "Show password"}>{shown ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>;
}

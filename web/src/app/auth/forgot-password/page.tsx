"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-container-low font-body-md text-on-surface">
      {/* Background Decorative Element (Subtle Abstract) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-container opacity-5 blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-secondary opacity-5 blur-[120px]"></div>
      </div>

      {/* Main Recovery Card */}
      <main className="relative z-10 w-full max-w-[480px]">
        {/* Brand Identity Header */}
        <div className="text-center mb-stack-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-container rounded-xl mb-stack-md shadow-[0px_4px_20px_rgba(61,61,61,0.08)]">
            <span className="material-symbols-outlined text-on-primary text-4xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>school</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary tracking-tight font-semibold">Kanvise LMS</h2>
        </div>

        {/* Focused Recovery Surface */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 shadow-[0px_4px_20px_rgba(61,61,61,0.08)]">
          {success ? (
            <div className="text-center py-stack-lg animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-stack-lg">
                <span className="material-symbols-outlined text-green-600 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-stack-sm font-semibold">Email Sent!</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
                We've sent a password reset link to <br />
                <span className="font-bold text-primary">{email}</span>
              </p>
              <Link href="/auth/login" className="w-full flex items-center justify-center bg-primary-container text-on-primary font-headline-sm text-headline-sm py-4 rounded-lg transition-all">
                Return to Login
              </Link>
              <button onClick={() => setSuccess(false)} className="mt-4 text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors uppercase tracking-wider font-semibold">
                Did not receive email? Try again.
              </button>
            </div>
          ) : (
            <>
              {/* Header Section */}
              <header className="mb-stack-lg">
                <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm font-bold tracking-tight">Reset Your Password</h1>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </header>

              {error && (
                <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm border border-error/20 animate-in fade-in">
                  {error}
                </div>
              )}

              {/* Recovery Form */}
              <form className="space-y-stack-lg" onSubmit={handleReset}>
                {/* Email Input Group */}
                <div className="space-y-stack-sm">
                  <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors">mail</span>
                    </div>
                    <input 
                      className="w-full pl-12 pr-4 py-4 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-0 focus:border-primary focus:outline-none transition-all placeholder:text-outline-variant" 
                      id="email" 
                      name="email" 
                      placeholder="tutor@institution.edu" 
                      required 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* CTA Button */}
                <button 
                  disabled={loading}
                  className="w-full bg-secondary hover:bg-secondary-container text-on-secondary font-headline-sm text-headline-sm font-semibold py-4 rounded-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 group shadow-lg shadow-secondary/10 disabled:opacity-70 disabled:cursor-not-allowed" 
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer Links */}
              <footer className="mt-stack-lg pt-stack-lg border-t border-outline-variant flex flex-col items-center gap-4">
                <Link className="inline-flex items-center gap-2 font-body-md text-body-md text-primary font-semibold hover:text-primary-container transition-colors group" href="/auth/login">
                  <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                  Back to Login
                </Link>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-[280px]">
                  If you don't receive an email within 5 minutes, please check your spam folder or 
                  <a className="text-secondary hover:underline font-medium ml-1" href="#">Contact Support</a>.
                </p>
              </footer>
            </>
          )}
        </div>

        {/* System Status Footer (Subtle) */}
        <div className="mt-stack-lg flex justify-between items-center px-4">
          <span className="font-label-md text-label-md font-semibold text-on-surface-variant/60 flex items-center gap-1 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Operational
          </span>
          <span className="font-label-md text-label-md font-semibold text-on-surface-variant/60 tracking-wider">
            v2.4.1 Build 2024
          </span>
        </div>
      </main>
    </div>
  );
}

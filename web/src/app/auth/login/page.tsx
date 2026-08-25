"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { AuthLogo } from "@/components/auth/auth-logo";
import { safeRedirectPath } from "@/lib/safe-redirect";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = safeRedirectPath(searchParams.get("redirect"));
  const reason = searchParams.get("reason");
  const registerHref = redirectParams
    ? `/auth/register?redirect=${encodeURIComponent(redirectParams)}`
    : "/auth/register";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (redirectParams) {
      router.push(redirectParams);
      return;
    }

    try {
      if (!signInData.session?.access_token) throw new Error('Your session could not be started')
      // Existing accounts created before trusted role claims were introduced
      // need one profile resolution before routing. The API backfills the
      // server-controlled claims from the canonical profile; refreshing here
      // prevents the web middleware from treating that account as a student.
      const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${signInData.session.access_token}` },
      })
      const profileBody = await profileResponse.json()
      if (!profileResponse.ok || !profileBody.user?.role) throw new Error(profileBody.error || 'Could not load your account')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
      window.location.assign(['admin', 'tutor'].includes(profileBody.user.role) ? '/dashboard' : '/dashboard/student')
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not open your account')
      setLoading(false)
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-kv-soft" style={{
      backgroundImage: 'radial-gradient(var(--kv-rodeo-dust) 0.5px, transparent 0.5px), radial-gradient(var(--kv-rodeo-dust) 0.5px, var(--kv-bg-soft) 0.5px)',
      backgroundSize: '24px 24px',
      backgroundPosition: '0 0, 12px 12px',
    }}>
      <main className="w-full max-w-[440px] animate-in fade-in duration-700 slide-in-from-bottom-4">
        <div className="bg-white border border-kv-dust/40 p-8 md:p-10 shadow-[0px_4px_20px_rgba(61,61,61,0.08)] rounded-lg">
          {/* Logo Section */}
          <div className="mb-8">
            <AuthLogo />
            <p className="text-sm text-kv-dark/70 font-light mt-1 uppercase tracking-widest text-center">Private OS for Nigerian Tutors</p>
          </div>

          {reason === "session_expired" && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
              Your session has expired. Please log in again.
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-kv-blue uppercase tracking-wider" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-kv-dust/60 rounded focus:outline-none focus:border-kv-blue focus:ring-1 focus:ring-kv-blue/30 text-kv-dark transition-all"
                  placeholder="tutor@kanvise.edu"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-kv-blue uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-kv-brown hover:underline transition-all font-medium"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-kv-dust/60 rounded focus:outline-none focus:border-kv-blue focus:ring-1 focus:ring-kv-blue/30 text-kv-dark transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-kv-blue transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Login CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kv-brown text-white font-bold py-3.5 rounded hover:bg-kv-brown/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 mt-2 focus:outline-none focus:ring-2 focus:ring-kv-brown focus:ring-offset-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Sign Up Toggle */}
          <div className="mt-8 pt-6 border-t border-kv-dust/30 text-center">
            <p className="text-center text-sm text-gray-600 mt-8">
              Don&apos;t have an account?{" "}
              <Link href={registerHref} className="font-semibold text-kv-brown hover:text-kv-dark transition-colors">
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Metadata */}
        <footer className="mt-8 text-center">
          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">
            © {new Date().getFullYear()} Kanvise. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-kv-bg"><Loader2 className="w-8 h-8 animate-spin text-kv-blue" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

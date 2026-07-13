"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kv-soft p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 border-l-4 border-kv-blue text-center">
          <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-kv-dark mb-3">Check your email</h2>
          <p className="text-gray-500 mb-6">
            If an account exists for <span className="font-semibold text-kv-dark">{email}</span>, we&apos;ve sent a password reset link.
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            className="text-kv-blue hover:text-kv-brown font-medium"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-kv-soft p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 border-l-4 border-kv-blue">
        <button 
          onClick={() => router.push("/auth/login")}
          className="flex items-center text-sm text-gray-500 hover:text-kv-dark mb-6 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to login
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-kv-dark mb-2">Reset Password</h1>
          <p className="text-gray-500 mt-2 text-[15px]">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-error rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
              placeholder="Enter your email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Send Reset Link"}
          </button>
        </form>
      </div>
    </div>
  );
}

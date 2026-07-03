"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = searchParams.get("redirect");
  const reason = searchParams.get("reason");
  
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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Refresh router to let middleware handle role-based redirection
    if (redirectParams) {
      router.push(redirectParams);
    } else {
      // Pushing to an auth route will trigger the middleware which will redirect to the correct dashboard
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-kv-soft p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 border-l-4 border-kv-blue">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-kv-dark mb-2">Welcome Back</h1>
          <p className="text-gray-500">Sign in to your Kanvise account</p>
        </div>

        {reason === "session_expired" && (
          <div className="mb-6 p-3 bg-red-50 text-error rounded-md text-sm border border-red-100">
            Your session has expired. Please log in again.
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-error rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-kv-dark" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={() => router.push("/auth/forgot-password")}
                className="text-sm text-kv-blue hover:text-kv-brown transition-colors font-medium"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-kv-dark"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <button
            onClick={() => router.push("/auth/register")}
            className="text-kv-brown font-semibold hover:underline"
          >
            Create one
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  
  // If there's a redirect param, this is a student enrolling. 
  // Otherwise, it's an Admin registering manually.
  const isStudentFlow = !!redirectParam;
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(isStudentFlow ? "student" : "admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Prepare redirect URL for the Supabase email verification callback
    // We pass the role and the original redirect param so the callback knows what to do
    let redirectTo = `${window.location.origin}/api/auth/callback?role=${role}`;
    if (redirectParam) {
      redirectTo += `&redirect=${encodeURIComponent(redirectParam)}`;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          // role will be handled securely by Hono on the callback
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
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
            We've sent a verification link to <span className="font-semibold text-kv-dark">{email}</span>. 
            Please click the link to activate your account.
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-kv-dark mb-2">Create Account</h1>
          <p className="text-gray-500">
            {isStudentFlow ? "Sign up to enroll in your programme" : "Set up your Kanvise profile"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-error rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="firstName">
                First Name
              </label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="lastName">
                Last Name
              </label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all"
                placeholder="Doe"
              />
            </div>
          </div>

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
            <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue transition-all pr-10"
                placeholder="Create a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-kv-dark"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Must be at least 8 characters</p>
          </div>
          
          {!isStudentFlow && (
            <div>
              <label className="block text-sm font-semibold text-kv-dark mb-1.5">Account Role</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="role" 
                    value="admin" 
                    checked={role === "admin"}
                    onChange={(e) => setRole(e.target.value)}
                    className="text-kv-blue focus:ring-kv-blue"
                  />
                  <span className="text-sm">School Admin</span>
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-70 mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Create Account"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/auth/login")}
            className="text-kv-brown font-semibold hover:underline"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    
    // Automatically redirect after a short delay
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2000);
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
          <h2 className="text-2xl font-bold text-kv-dark mb-3">Password Updated</h2>
          <p className="text-gray-500 mb-6">
            Your password has been successfully reset. Redirecting you to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-kv-soft p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 border-l-4 border-kv-blue">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-kv-dark mb-2">Create New Password</h1>
          <p className="text-gray-500">
            Enter your new password below.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-error rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-1.5" htmlFor="password">
              New Password
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
                placeholder="Must be at least 8 characters"
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
            className="w-full bg-kv-blue hover:bg-kv-blue/90 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-70 mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const supabase = createClient();

  // Password validation checks
  const hasMinLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[\d!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const isValid = hasMinLength && hasUppercase && hasNumberOrSymbol && password === confirmPassword && password !== "";

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    const { error: updateError, data } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    
    // Automatically redirect to appropriate dashboard based on role
    setTimeout(async () => {
      // The updateUser call usually updates the session, but we can explicitly get the user
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.app_metadata?.kanvise_role || user?.app_metadata?.role;
      
      let redirectUrl = "/";
      if (role === "admin") {
        // Technically an admin without a school needs to go to setup, but the Hono middleware handles it
        // and Next.js middleware might also handle it, but we can just send them to /dashboard/admin
        redirectUrl = "/dashboard/admin";
      } else if (role === "tutor") {
        redirectUrl = "/dashboard/tutor";
      } else if (role === "student") {
        redirectUrl = "/dashboard/student";
      }
      
      router.push(redirectUrl);
      router.refresh();
    }, 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-surface-container font-body-md text-on-surface p-6">
      {/* Abstract Background Texture */}
      <div 
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center mix-blend-multiply pointer-events-none" 
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCahZy7I9sWCjjimOXPZn9tKldsw1esRFZa2B7h89xy3NvBwmqburrJpCSdFU2ktVyaMd_6SYllFZ6NcucgN8eEd6X6SO9g7qFnbVaPybQFPH5vwVJbcuvlcYt3V5gi6m3Sxf6wYCXtDvHSLb7yy3Cn9dJv9lhCqwt9gch7SOAQ_dg96vt_A8OO7vqgFBoZlAoQRyXdeMFyFjSvPXN33v5l44IZkYoKXvEcwfoZjL3dN7VMogh2pQ-bkoy6GeLZhrg1EcXUIeiBBqA')" }}
      ></div>

      {/* Centered Card Container (Level 1 Elevation) */}
      <main className="w-full max-w-[480px] bg-surface-container-lowest border border-outline-variant rounded-lg p-10 shadow-[0px_4px_20px_rgba(61,61,61,0.08)] z-10 relative overflow-hidden transition-all duration-300">
        
        {success ? (
          <div className="text-center py-stack-lg animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center mx-auto mb-stack-md animate-bounce">
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
            </div>
            <h2 className="font-headline-md text-headline-md font-bold text-primary-container mb-3 tracking-tight">System Secured</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg leading-relaxed">
                Your password has been successfully updated. Your institutional access is ready.
            </p>
            <div className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary font-label-md text-label-md uppercase tracking-wider font-semibold py-4 px-6 rounded opacity-80 cursor-wait">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Redirecting to Portal...</span>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {/* Header Section */}
            <header className="text-center mb-stack-lg">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-primary-container text-on-primary mb-stack-md shadow-lg shadow-primary-container/20">
                <span className="material-symbols-outlined text-[24px]">lock_reset</span>
              </div>
              <h1 className="font-headline-md text-headline-md font-bold text-primary-container mb-2 tracking-tight">Kanvise</h1>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Create New Password</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-[85%] mx-auto leading-relaxed">
                  Your new password must be unique from those previously used to maintain elite security.
              </p>
            </header>

            {error && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm border border-error/20 animate-in fade-in">
                {error}
              </div>
            )}

            {/* Reset Form */}
            <form className="space-y-6" onSubmit={handleUpdate}>
              {/* Password Input Group */}
              <div className="space-y-stack-sm">
                <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold" htmlFor="new_password">
                    New Password
                </label>
                <div className="relative group">
                  <input 
                    className="w-full bg-surface border border-outline-variant rounded py-3 px-4 font-body-md text-body-md text-on-surface transition-all outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container" 
                    id="new_password" 
                    placeholder="Enter new password" 
                    required 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    aria-label="Toggle password visibility" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary-container transition-colors focus:outline-none" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {/* Password Requirements Indicators */}
              <div className="bg-surface p-4 border border-outline-variant rounded space-y-3">
                <h3 className="font-label-md text-label-md text-on-surface font-semibold">Password Requirements</h3>
                <ul className="space-y-2">
                  <li className={`flex items-center gap-3 font-body-sm text-body-sm transition-colors ${hasMinLength ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: hasMinLength ? "'FILL' 1" : "'FILL' 0" }}>
                      {hasMinLength ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span>Minimum 12 characters</span>
                  </li>
                  <li className={`flex items-center gap-3 font-body-sm text-body-sm transition-colors ${hasUppercase ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: hasUppercase ? "'FILL' 1" : "'FILL' 0" }}>
                      {hasUppercase ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span>At least one uppercase letter</span>
                  </li>
                  <li className={`flex items-center gap-3 font-body-sm text-body-sm transition-colors ${hasNumberOrSymbol ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: hasNumberOrSymbol ? "'FILL' 1" : "'FILL' 0" }}>
                      {hasNumberOrSymbol ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span>At least one number or symbol</span>
                  </li>
                </ul>
              </div>

              {/* Confirm Password Input Group */}
              <div className="space-y-stack-sm">
                <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold" htmlFor="confirm_password">
                    Confirm Password
                </label>
                <div className="relative">
                  <input 
                    className="w-full bg-surface border border-outline-variant rounded py-3 px-4 font-body-md text-body-md text-on-surface transition-all outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container" 
                    id="confirm_password" 
                    placeholder="Re-enter new password" 
                    required 
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button 
                    aria-label="Toggle password visibility" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary-container transition-colors focus:outline-none" 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined">{showConfirmPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-error mt-2">Passwords do not match.</p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4">
                <button 
                  disabled={loading || !isValid}
                  className="w-full flex items-center justify-center gap-2 bg-secondary text-on-secondary font-label-md text-label-md uppercase tracking-wider font-semibold py-4 px-6 rounded hover:bg-on-secondary-fixed-variant transition-colors group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-secondary/10" 
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Update Password</span>
                      <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="w-full block text-center mt-6 font-body-sm text-body-sm text-on-surface-variant hover:text-primary-container transition-colors font-medium"
                >
                  Cancel and return to Login
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

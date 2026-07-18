"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2, Mail, Lock, User, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Suspense } from "react";

function RegisterContent() {
import { Suspense } from "react";

function RegisterContent() {
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
  const [role] = useState(isStudentFlow ? "student" : "admin"); // Role is locked
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
      <div className="min-h-screen flex items-center justify-center bg-kv-soft p-4 relative overflow-hidden font-sans">
        {/* Ambient Background Elements */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-kv-blue/10 to-transparent pointer-events-none"></div>
        
        {/* Main Card Container */}
        <div className="z-10 bg-white w-full max-w-[480px] rounded-xl border border-kv-dust shadow-2xl p-8 md:p-10 relative overflow-hidden flex flex-col items-center text-center">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-kv-blue"></div>
          
          {/* Brand Mark */}
          <div className="mb-6 w-full flex justify-center">
            <span className="text-2xl font-bold text-kv-blue tracking-tight">Kanvise</span>
          </div>
          
          {/* Icon Graphic */}
          <div className="w-20 h-20 rounded-full bg-kv-blue/5 flex items-center justify-center mb-6 border border-kv-blue/20">
            <svg className="w-10 h-10 text-kv-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          {/* Text Content */}
          <h1 className="text-2xl font-bold text-kv-dark mb-2 w-full">Check your email</h1>
          <p className="text-kv-dark/70 mb-8 w-full max-w-[360px] mx-auto text-sm leading-relaxed">
            We&apos;ve sent a verification link to <span className="font-semibold text-kv-dark">{email}</span>. Please click the link to activate your account.
          </p>
          
          {/* Contextual Reminder */}
          <div className="w-full bg-[#f5f3f2] border border-[#e4e2e1] rounded-lg p-4 mb-8 flex items-start text-left gap-3">
            <svg className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-bold text-kv-dark uppercase tracking-wider mb-1">Didn&apos;t receive the email?</p>
              <p className="text-xs text-kv-dark/70">Check your spam folder or verify that the email address provided was correct.</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="w-full flex flex-col gap-3">
            <button 
              onClick={() => window.location.href = '/auth/login'}
              className="w-full bg-kv-brown hover:bg-kv-brown/90 text-white py-3 px-6 rounded flex items-center justify-center gap-2 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-kv-soft">
      <main className="w-full max-w-[1440px] min-h-screen grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-white">
        
        {/* Left Side: Visual Anchor & Value Props */}
        <section className="hidden lg:flex flex-col relative p-12 bg-kv-blue overflow-hidden">
          {/* Background Image with Overlay */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center" 
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop')" }}
          ></div>
          <div className="absolute inset-0 z-10 bg-kv-blue/90 mix-blend-multiply"></div>
          
          {/* Branding */}
          <div className="relative z-20 mb-auto">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-kv-brown w-10 h-10" />
              <h1 className="text-3xl font-bold text-white tracking-tight">Kanvise</h1>
            </div>
            <p className="text-white/80 mt-2 font-medium">Built for Nigerian tutorial centres</p>
          </div>
          
          {/* Value Propositions */}
          <div className="relative z-20 space-y-12">
            <div>
              <h2 className="text-5xl font-bold text-white mb-4 leading-tight">
                {isStudentFlow ? (
                  <>Access Your<br/><span className="text-[#ff9653]">School&apos;s Portal</span></>
                ) : (
                  <>Set up your<br/><span className="text-[#ff9653]">school.</span></>
                )}
              </h2>
              <p className="text-lg text-white/90 max-w-md">
                {isStudentFlow 
                  ? "Log in to access your classes, track your performance, and manage your learning."
                  : "Add your programmes, invite your tutors, and get paid for your classes — all from one dashboard built for Nigerian tutorial centres. Takes about 2 minutes."
                }
              </p>
            </div>
            
            {!isStudentFlow && (
              <div className="grid gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-kv-brown/20 rounded-lg">
                    <ShieldCheck className="text-kv-brown w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">No more chasing fees on WhatsApp.</h3>
                    <p className="text-sm text-white/80 mt-1">Get paid instantly to your account once a students enrols, no spreadsheets, no manual tracking.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-kv-brown/20 rounded-lg">
                    <svg className="text-kv-brown w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Everything in one place.</h3>
                    <p className="text-sm text-white/80 mt-1">Attendance, notes, assignments, and mock exams — organized by course, visible to your students automatically.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer Badge */}
          <div className="relative z-20 mt-auto pt-8 border-t border-white/10 flex items-center gap-2">
            <ShieldCheck className="text-white/60 w-4 h-4" />
            <p className="text-xs text-white/60 uppercase tracking-widest font-semibold">Payments secured by Paystack</p>
          </div>
        </section>

        {/* Right Side: Registration Form */}
        <section className="flex flex-col justify-center items-center p-8 md:p-12 bg-white relative">
          <div className="w-full max-w-[480px]">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-2 mb-10">
              <ShieldCheck className="text-kv-blue w-8 h-8" />
              <span className="text-2xl font-bold text-kv-blue">Kanvise</span>
            </div>
            
            <header className="mb-10">
              <h2 className="text-3xl font-bold text-kv-blue mb-2">Create Account</h2>
              <p className="text-kv-dark/70">
                {isStudentFlow 
                  ? "Sign up to enroll in your programme." 
                  : "Set up your Kanvise profile to start managing your school."
                }
              </p>
            </header>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* First Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-kv-dark uppercase tracking-wider" htmlFor="firstName">First Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      id="firstName" 
                      type="text" 
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-white border border-kv-dust/80 rounded-lg focus:outline-none focus:border-kv-blue focus:ring-1 focus:ring-kv-blue/30 transition-all text-kv-dark" 
                      placeholder="John" 
                    />
                  </div>
                </div>
                
                {/* Last Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-kv-dark uppercase tracking-wider" htmlFor="lastName">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      id="lastName" 
                      type="text" 
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-white border border-kv-dust/80 rounded-lg focus:outline-none focus:border-kv-blue focus:ring-1 focus:ring-kv-blue/30 transition-all text-kv-dark" 
                      placeholder="Doe" 
                    />
                  </div>
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-kv-dark uppercase tracking-wider" htmlFor="email">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    id="email" 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-kv-dust/80 rounded-lg focus:outline-none focus:border-kv-blue focus:ring-1 focus:ring-kv-blue/30 transition-all text-kv-dark" 
                    placeholder="tutor@institution.edu.ng" 
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-kv-dark uppercase tracking-wider" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    id="password" 
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    pattern="(?=.*[A-Z])(?=.*\d).{8,}"
                    title="Must contain at least one number and one uppercase letter, and at least 8 or more characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-white border border-kv-dust/80 rounded-lg focus:outline-none focus:border-kv-blue focus:ring-1 focus:ring-kv-blue/30 transition-all text-kv-dark" 
                    placeholder="••••••••" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-kv-blue transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">Minimum 8 characters, at least 1 uppercase letter and 1 number.</p>
              </div>

              {/* Terms & Privacy 
              <div className="flex items-start gap-3 pt-2">
                <div className="flex items-center h-5 mt-0.5">
                  <input 
                    id="terms" 
                    type="checkbox" 
                    required
                    className="w-4 h-4 text-kv-brown border-kv-dust rounded focus:ring-kv-brown cursor-pointer" 
                  />
                </div>
                <label className="text-sm text-kv-dark/70" htmlFor="terms">
                  I agree to the <a href="#" className="text-kv-brown font-semibold hover:underline">Terms of Service</a> and <a href="#" className="text-kv-brown font-semibold hover:underline">Privacy Policy</a>.
                </label>
              </div>*/}

              {/* CTA */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-kv-brown text-white font-bold rounded-lg shadow-sm hover:bg-kv-brown/90 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-kv-brown focus:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Footer Switch */}
            <div className="mt-10 pt-6 border-t border-kv-dust/30 text-center">
              <p className="text-sm text-kv-dark/70">
                Already have an account?{" "}
                <Link href="/auth/login" className="text-kv-blue font-bold hover:text-kv-brown transition-colors inline-flex items-center gap-1 group">
                  Login here
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </p>
            </div>
          </div>
          
         
        </section>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-kv-bg"><Loader2 className="w-8 h-8 animate-spin text-kv-blue" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-kv-soft p-4 relative overflow-hidden font-sans">
      {/* Ambient Background Elements */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-kv-blue/10 to-transparent pointer-events-none"></div>
      
      {/* Main Card Container */}
      <div className="z-10 bg-white w-full max-w-[480px] rounded-xl border border-kv-dust shadow-card p-8 md:p-10 relative overflow-hidden flex flex-col items-center text-center">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#ba1a1a]"></div>
        
        {/* Brand Mark */}
        <div className="mb-6 w-full flex justify-center">
          <span className="text-2xl font-bold text-kv-blue tracking-tight">Kanvise</span>
        </div>
        
        {/* Icon Graphic */}
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6 border border-red-100">
          <ShieldAlert className="w-10 h-10 text-[#ba1a1a]" strokeWidth={1.5} />
        </div>
        
        {/* Text Content */}
        <h1 className="text-2xl font-bold text-kv-dark mb-2 w-full">Verification Failed</h1>
        <p className="text-kv-dark/70 mb-8 w-full max-w-[360px] mx-auto text-sm leading-relaxed">
          The link you clicked is invalid or has expired. This usually happens if the link was already used or opened in a different browser.
        </p>
        
        {/* Contextual Reminder */}
        <div className="w-full bg-[#f5f3f2] border border-[#e4e2e1] rounded-lg p-4 mb-8 flex items-start text-left gap-3">
          <ShieldAlert className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-xs font-bold text-kv-dark uppercase tracking-wider mb-1">What happened?</p>
            <p className="text-xs text-kv-dark/70">Ensure <b>PKCE Auth Flow</b> is turned on in your Supabase project settings, and you haven&apos;t clicked the link twice.</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Link href="/auth/login" className="w-full bg-kv-brown hover:bg-kv-brown/90 text-white py-3 px-6 rounded flex items-center justify-center gap-2 transition-colors font-bold text-xs uppercase tracking-wider shadow-sm">
            Go to Login
          </Link>
          <Link href="/auth/register" className="w-full bg-transparent border border-kv-dust hover:bg-gray-50 text-kv-dark py-3 px-6 rounded flex items-center justify-center gap-2 transition-colors font-bold text-xs uppercase tracking-wider mt-1">
            Register Again
          </Link>
        </div>
      </div>
    </div>
  );
}

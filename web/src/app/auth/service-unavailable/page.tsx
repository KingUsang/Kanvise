"use client"

import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function AuthServiceUnavailablePage() {
  return <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-[#1b1c1c] sm:bg-[#f7f7f9] sm:px-8 sm:py-8">
    <section className="w-full max-w-[500px] rounded-[20px] border border-[#e1e0e6] bg-white px-5 py-8 text-center sm:rounded-[24px] sm:px-10 sm:py-11 lg:px-12">
      <Link href="/" aria-label="Kanvise home" className="mx-auto mb-9 flex w-fit items-center justify-center"><img src="/kanvise_logo_small_blue.png" alt="" className="h-11 w-11 object-contain" /></Link>
      <h1 className="text-[1.75rem] font-semibold tracking-[-.03em] text-[#211969]">Kanvise is temporarily unavailable</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#625e6e]">We couldn’t complete that step right now. Please try again.</p>
      <div className="mt-7 space-y-3"><button type="button" onClick={() => window.location.reload()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white hover:bg-[#7d3903]"><RefreshCw aria-hidden size={16}/>Try again</button><Link href="/auth/login" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d7d5df] px-5 text-sm font-medium text-[#2e2877] hover:bg-[#fafafa]"><ArrowLeft aria-hidden size={16}/>Back to sign in</Link></div>
    </section>
  </main>
}

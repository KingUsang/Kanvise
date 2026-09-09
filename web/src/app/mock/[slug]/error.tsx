'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function MockLinkError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen bg-[#f8f7f5] px-4 py-12 sm:px-6 sm:py-20">
    <section className="mx-auto max-w-xl rounded-3xl border border-[#ead8d0] bg-white p-7 text-center sm:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1eb] text-[#994704]"><AlertCircle aria-hidden="true" /></span>
      <h1 className="mt-5 text-2xl font-semibold">This mock link is unavailable</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#716c76]">The link may be closed, unpublished or temporarily unavailable. Try again, or ask the person who shared it to confirm the link.</p>
      <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row"><Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d9d3cf] px-5 text-sm font-semibold text-[#2e2877]">Go to Kanvise</Link><button onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2e2877] px-5 text-sm font-semibold text-white"><RefreshCw size={17} />Try again</button></div>
    </section>
  </main>
}

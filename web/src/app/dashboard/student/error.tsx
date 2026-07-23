'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

export default function StudentPortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('student_portal.render_failed', error) }, [error])

  return <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:py-20">
    <section className="rounded-2xl border border-[#ead8d0] bg-white p-7 text-center sm:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1eb] text-[#994704]"><AlertCircle aria-hidden="true" /></span>
      <h1 className="mt-5 text-2xl font-semibold">We couldn’t load this page</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#716c76]">Check your connection and try again. Your saved school records have not been changed.</p>
      <button onClick={reset} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2e2877] px-5 text-sm font-semibold text-white"><RefreshCw size={17} />Try again</button>
    </section>
  </main>
}

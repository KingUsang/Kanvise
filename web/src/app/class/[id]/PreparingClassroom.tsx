'use client'

import { useEffect, useState } from 'react'

export default function PreparingClassroom({ retryAfterSeconds = 4 }: { retryAfterSeconds?: number }) {
  const [seconds, setSeconds] = useState(retryAfterSeconds)

  useEffect(() => {
    const reload = window.setTimeout(() => window.location.reload(), retryAfterSeconds * 1_000)
    const countdown = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1_000)
    return () => {
      window.clearTimeout(reload)
      window.clearInterval(countdown)
    }
  }, [retryAfterSeconds])

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-[#e5e1dd] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eeeafe] text-[#2e2877]">
          <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
        </div>
        <h1 className="mt-5 text-xl font-bold text-[#180d62]">Preparing your classroom</h1>
        <p className="mt-2 text-sm leading-6 text-[#66616c]">
          The live-class server is waking up. Keep this page open—we will connect you automatically.
        </p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#eeeafe]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[#994704]" />
        </div>
        <p className="mt-3 text-xs text-[#787582]">Checking again in {seconds} second{seconds === 1 ? '' : 's'}…</p>
      </div>
    </main>
  )
}

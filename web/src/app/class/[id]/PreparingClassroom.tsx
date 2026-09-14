'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PreparingClassroom({
  retryAfterSeconds = 4,
  classTitle,
  courseName,
  isHost,
}: {
  retryAfterSeconds?: number
  classTitle: string
  courseName: string | null
  isHost: boolean
}) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(retryAfterSeconds)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    // Refresh the server component in-place. A document reload replays the
    // route loading UI and makes waking a classroom look like several failures.
    const refresh = window.setTimeout(() => router.refresh(), retryAfterSeconds * 1_000)
    const countdown = window.setInterval(() => {
      setSeconds(value => Math.max(0, value - 1))
      setElapsedSeconds(value => value + 1)
    }, 1_000)
    return () => {
      window.clearTimeout(refresh)
      window.clearInterval(countdown)
    }
  }, [retryAfterSeconds, router])

  const takingLonger = elapsedSeconds >= 15
  const intro = isHost
    ? 'We are getting your classroom ready and will take you in automatically.'
    : 'Your tutor is opening the classroom. We will join you as soon as it is ready.'

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 text-left shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#994704]">Live class</p>
        <h1 className="mt-2 truncate text-xl font-bold text-[#180d62]">{classTitle}</h1>
        {courseName ? <p className="mt-1 text-sm text-[#66616c]">{courseName}</p> : null}
        <div className="mt-6 flex gap-3">
          <span className="material-symbols-outlined mt-0.5 animate-spin text-[#2e2877]" aria-hidden="true">progress_activity</span>
          <div>
            <h2 className="font-semibold text-[#1b1c1c]">{isHost ? 'Preparing your classroom' : 'Getting the classroom ready'}</h2>
            <p className="mt-1 text-sm leading-6 text-[#66616c]">{intro}</p>
          </div>
        </div>
        <ol className="mt-6 space-y-3 border-l border-[#ded8d3] pl-4 text-sm">
          <li className="font-medium text-[#2e2877]">Preparing your classroom</li>
          <li className="text-[#66616c]">Setting up the live space</li>
          <li className="text-[#66616c]">Taking you in automatically</li>
        </ol>
        {takingLonger ? <div className="mt-6 rounded-xl bg-[#f7f5f3] p-4"><p className="text-sm font-semibold text-[#1b1c1c]">This is taking longer than usual.</p><p className="mt-1 text-sm leading-5 text-[#66616c]">Your class is still safe. Check again, or return to your classes and reopen it.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => router.refresh()} className="rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Check again</button><Link href="/dashboard/schedule" className="rounded-lg border border-[#c8c5d2] px-4 py-2 text-sm font-semibold text-[#2e2877]">Back to classes</Link></div></div> : <p className="mt-6 text-xs text-[#787582]">We&apos;ll check again in {seconds} second{seconds === 1 ? '' : 's'}…</p>}
      </div>
    </main>
  )
}

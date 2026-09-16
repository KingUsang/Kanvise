'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import ClientClassroom from './ClientClassroom'

type ClassroomToken = {
  livekit_room_name: string
  access_token: string
  livekit_url: string
  is_host: boolean
  class_title: string
  course_name: string | null
}

export default function PreparingClassroom({
  retryAfterSeconds = 4,
  classId,
  isStarting,
  classTitle,
  courseName,
  isHost,
}: {
  retryAfterSeconds?: number
  classId: string
  isStarting: boolean
  classTitle: string
  courseName: string | null
  isHost: boolean
}) {
  const [seconds, setSeconds] = useState(retryAfterSeconds)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [ready, setReady] = useState<ClassroomToken | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])

  const check = useCallback(async (signal: AbortSignal) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Your session has expired. Sign in again to enter this class.')
    const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}/${isStarting ? 'start' : 'join'}`
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, cache: 'no-store', signal })
    const body = await response.json().catch(() => null)
    if (response.status === 202 && body?.data?.state === 'preparing') return null
    if (!response.ok) throw new Error(body?.error || 'We could not open the classroom.')
    return body.data as ClassroomToken
  }, [classId, isStarting, supabase])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let timer: number | undefined
    let failures = 0
    const run = async () => {
      if (cancelled) return
      setOffline(!navigator.onLine)
      try {
        const result = await check(controller.signal)
        if (cancelled) return
        if (result) { setReady(result); return }
        failures = 0
        setError(null)
      } catch (cause) {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return
        failures += 1
        setOffline(!navigator.onLine)
        if (failures >= 3) setError(cause instanceof Error ? cause.message : 'We could not open the classroom.')
      }
      if (!cancelled) timer = window.setTimeout(run, Math.min(10_000, Math.max(2_000, retryAfterSeconds * 1_000)))
    }
    timer = window.setTimeout(run, retryAfterSeconds * 1_000)
    const countdown = window.setInterval(() => {
      setSeconds(value => Math.max(0, value - 1))
      setElapsedSeconds(value => value + 1)
    }, 1_000)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) window.clearTimeout(timer)
      window.clearInterval(countdown)
    }
  }, [check, retryAfterSeconds, retryKey])

  if (ready) return <ClientClassroom token={ready.access_token} serverUrl={ready.livekit_url} roomName={ready.livekit_room_name} classId={classId} isHost={ready.is_host} classTitle={ready.class_title || classTitle} courseName={ready.course_name ?? courseName} />

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
            <h2 className="font-semibold text-[#1b1c1c]">Getting your classroom ready</h2>
            <p className="mt-1 text-sm leading-6 text-[#66616c]">{intro}</p>
          </div>
        </div>
        <ol className="mt-6 space-y-3 border-l border-[#ded8d3] pl-4 text-sm">
          <li className="font-medium text-[#2e2877]">Preparing your classroom</li>
          <li className="text-[#66616c]">Setting up the live space</li>
          <li className="text-[#66616c]">Taking you in automatically</li>
        </ol>
        {offline ? <div className="mt-5 rounded-xl bg-[#fff3e8] p-4 text-sm text-[#7a3903]">You&apos;re offline. We&apos;ll reconnect automatically.</div> : null}
        {error || takingLonger ? <div className="mt-6 rounded-xl bg-[#f7f5f3] p-4"><p className="text-sm font-semibold text-[#1b1c1c]">{error || 'This is taking longer than usual.'}</p><p className="mt-1 text-sm leading-5 text-[#66616c]">Your class is still safe. You can try again or return to your classes.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => { setError(null); setElapsedSeconds(0); setSeconds(retryAfterSeconds); setRetryKey(value => value + 1) }} className="rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Try again</button><Link href="/dashboard/schedule" className="rounded-lg border border-[#c8c5d2] px-4 py-2 text-sm font-semibold text-[#2e2877]">Back to classes</Link></div></div> : <p className="mt-6 text-xs text-[#787582]">We&apos;ll check again in {seconds} second{seconds === 1 ? '' : 's'}…</p>}
      </div>
    </main>
  )
}

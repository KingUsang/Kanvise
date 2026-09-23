'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import ClientClassroom from './ClientClassroom'
import PlugNmeetClassroom from './PlugNmeetClassroom'

type ClassroomToken = {
  provider?: 'livekit' | 'plugnmeet'
  livekit_room_name?: string
  access_token?: string
  livekit_url?: string
  is_host: boolean
  class_title: string
  course_name: string | null
  room_id?: string
  join_token?: string
  server_url?: string
  client_files?: { css_files: string[]; js_files: string[] }
}

type Phase = 'starting_vm' | 'booting' | 'connecting' | 'ready' | 'unavailable'

const PHASES: { id: Phase; label: string; description: string }[] = [
  { id: 'starting_vm', label: 'Starting classroom', description: 'Waking up the live class server' },
  { id: 'booting',    label: 'Booting up',          description: 'Setting up the live space' },
  { id: 'connecting', label: 'Almost there',         description: 'Connecting to the classroom' },
]

const PHASE_ORDER: Phase[] = ['starting_vm', 'booting', 'connecting', 'ready']

function phaseIndex(p: Phase) {
  const i = PHASE_ORDER.indexOf(p)
  return i === -1 ? 0 : i
}

const MESSAGES: Record<Phase, string> = {
  starting_vm: 'Waking up the classroom server — this usually takes under a minute.',
  booting:     'The server is up and loading. Almost ready for you.',
  connecting:  'Final checks done. You\'re about to be taken in.',
  ready:       'The classroom is ready. Taking you in now…',
  unavailable: '',
}

export default function PreparingClassroom({
  classId,
  isStarting,
  classTitle,
  courseName,
  isHost,
}: {
  classId: string
  isStarting: boolean
  classTitle: string
  courseName: string | null
  isHost: boolean
}) {
  const [phase, setPhase]     = useState<Phase>('starting_vm')
  const [error, setError]     = useState<string | null>(null)
  const [ready, setReady]     = useState<ClassroomToken | null>(null)
  const [offline, setOffline] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Keep a stable supabase client across re-renders
  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  )

  const fetchToken = useCallback(async (signal: AbortSignal) => {
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) throw new Error('Your session has expired. Sign in again to continue.')

    const base = `${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}`
    const endpoint = isStarting ? 'start' : 'join'
    const res = await fetch(`${base}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal,
    })
    const body = await res.json().catch(() => null)
    if (res.status === 202 && body?.data?.state === 'preparing') return null
    if (!res.ok) throw new Error(body?.error || 'We could not open the classroom.')
    return body.data as ClassroomToken
  }, [classId, isStarting])

  useEffect(() => {
    setPhase('starting_vm')
    setError(null)
    setOffline(!navigator.onLine)

    const controller = new AbortController()
    const { signal } = controller

    const run = async () => {
      try {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        if (!session) { setError('Your session has expired. Please sign in again.'); return }

        const intent = isStarting ? '?intent=start' : ''
        const base   = `${process.env.NEXT_PUBLIC_API_URL}/live-classes/${classId}`

        // Open a single long-lived fetch connection for SSE
        const res = await fetch(`${base}/readiness/stream${intent}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
          signal,
        })

        if (!res.ok || !res.body) {
          setError('Could not connect to the classroom. Please try again.')
          return
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE events are separated by double newlines
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data:')) continue
            try {
              const event = JSON.parse(line.slice(5).trim()) as { phase: Phase; message?: string }
              if (signal.aborted) return

              if (event.phase === 'unavailable') {
                setError(event.message ?? 'The classroom is temporarily unavailable.')
                return
              }

              setPhase(event.phase)

              if (event.phase === 'ready') {
                // Server is healthy — now get the actual classroom token
                const token = await fetchToken(signal)
                if (token) setReady(token)
                return
              }
            } catch { /* malformed event — skip */ }
          }
        }
      } catch (cause) {
        if (signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setOffline(!navigator.onLine)
        setError(cause instanceof Error ? cause.message : 'We could not connect to the classroom.')
      }
    }

    run()
    return () => controller.abort()
  }, [classId, isStarting, fetchToken, retryKey])

  // Handoff to the live classroom
  if (ready) {
    if (ready.provider === 'plugnmeet' && ready.join_token && ready.server_url && ready.client_files) {
      return <PlugNmeetClassroom roomId={ready.room_id || classId} joinToken={ready.join_token} serverUrl={ready.server_url} clientFiles={ready.client_files} classId={classId} isHost={ready.is_host} classTitle={ready.class_title || classTitle} />
    }
    if (!ready.access_token || !ready.livekit_url || !ready.livekit_room_name) {
      return null
    }
    return (
      <ClientClassroom
        token={ready.access_token}
        serverUrl={ready.livekit_url}
        roomName={ready.livekit_room_name}
        classId={classId}
        isHost={ready.is_host}
        classTitle={ready.class_title || classTitle}
        courseName={ready.course_name ?? courseName}
      />
    )
  }

  const activeIndex  = phaseIndex(phase)
  const statusMessage = error ? '' : MESSAGES[phase]

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#fbf9f8] px-5 font-sans">

      {/* Card */}
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            LIVE CLASS
          </span>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-[#180d62]">{classTitle}</h1>
          {courseName ? <p className="mt-1 text-sm text-[#66616c]">{courseName}</p> : null}
        </div>

        {/* Phase stepper */}
        <div className="rounded-2xl border border-[#e5e1dd] bg-white p-6 shadow-sm">
          {error ? null : (
            <div className="space-y-5">
              {PHASES.map((step, i) => {
                const isDone    = i < activeIndex
                const isActive  = i === activeIndex && phase !== 'ready'
                const isPending = i > activeIndex

                return (
                  <div key={step.id} className="flex items-start gap-4">
                    {/* Step icon */}
                    <div className="relative flex-shrink-0">
                      {isDone ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6f9f0]">
                          <svg className="h-4 w-4 text-[#12a05c]" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : isActive ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ece9f8]">
                          <span className="material-symbols-outlined animate-spin text-[1.1rem] text-[#2e2877]">
                            progress_activity
                          </span>
                        </span>
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f4f8]">
                          <span className="h-2 w-2 rounded-full bg-[#c8c5d2]" />
                        </span>
                      )}

                      {/* Connector line */}
                      {i < PHASES.length - 1 && (
                        <div className={`absolute left-1/2 top-9 h-5 w-px -translate-x-1/2 transition-colors duration-500 ${isDone ? 'bg-[#12a05c]' : 'bg-[#e5e1dd]'}`} />
                      )}
                    </div>

                    {/* Step text */}
                    <div className="pb-5">
                      <p className={`text-sm font-semibold transition-colors duration-300 ${isDone ? 'text-[#12a05c]' : isActive ? 'text-[#180d62]' : 'text-[#b0abb8]'}`}>
                        {step.label}
                      </p>
                      <p className={`mt-0.5 text-xs transition-colors duration-300 ${isActive ? 'text-[#66616c]' : 'text-[#c8c5d2]'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Status message / error */}
          {error ? (
            <div>
              <div className="flex items-start gap-3 rounded-xl bg-[#fff3e8] p-4">
                <span className="material-symbols-outlined mt-0.5 text-[1.1rem] text-[#b45309]">warning</span>
                <div>
                  <p className="text-sm font-semibold text-[#7c3d0e]">{error}</p>
                  <p className="mt-1 text-xs text-[#92400e]">Your class is still scheduled and safe. Try rejoining below.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => { setError(null); setPhase('starting_vm'); setRetryKey(k => k + 1) }}
                  className="rounded-xl bg-[#180d62] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2e2877] active:scale-95 transition-all"
                >
                  Try again
                </button>
                <Link
                  href="/dashboard/schedule"
                  className="rounded-xl border border-[#c8c5d2] px-5 py-2.5 text-sm font-semibold text-[#2e2877] hover:bg-[#f5f4f8] transition-colors"
                >
                  Back to classes
                </Link>
              </div>
            </div>
          ) : (
            <div className={`transition-all duration-500 ${error ? 'mt-0' : 'mt-2'}`}>
              {offline && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#fff3e8] px-4 py-3 text-xs font-medium text-[#7a3903]">
                  <span className="material-symbols-outlined text-[0.9rem]">wifi_off</span>
                  You&apos;re offline. Reconnecting automatically…
                </div>
              )}
              <p className="text-sm leading-relaxed text-[#66616c]">{statusMessage}</p>
              <p className="mt-4 text-xs text-[#b0abb8]">
                {isHost
                  ? 'You will be taken in automatically once the classroom is ready.'
                  : 'Your tutor is opening the classroom. You will be taken in automatically.'}
              </p>
            </div>
          )}
        </div>

        {/* Bottom tip */}
        {!error && (
          <p className="mt-4 text-center text-xs text-[#b0abb8]">
            First class of the day? It may take up to 60 seconds to start.
          </p>
        )}
      </div>
    </main>
  )
}

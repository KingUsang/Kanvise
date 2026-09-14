'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ClientClassroom from '@/app/class/[id]/ClientClassroom'

type PublicClass = { title: string; status: string; access_mode: 'anyone_with_link' | 'enrolled_learners'; scheduled_at: string; centre_name: string; centre_logo_url: string | null }
type JoinData = { livekit_room_name: string; access_token: string; livekit_url: string; class_title: string; course_name: null }

export default function PublicClassroom({ shareToken }: { shareToken: string }) {
  const [info, setInfo] = useState<PublicClass | null>(null)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<JoinData | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])

  const load = useCallback(async () => {
    const response = await fetch(`${apiUrl}/public/live-classes/${shareToken}`, { credentials: 'include', cache: 'no-store' })
    const body = await response.json().catch(() => null)
    if (!response.ok) { setError(body?.error || 'This class link is unavailable'); return }
    setInfo(body.data); setError(null)
  }, [apiUrl, shareToken])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session))) }, [supabase])
  useEffect(() => {
    if (info?.status !== 'scheduled') return
    const timer = window.setInterval(() => void load(), 10_000)
    return () => window.clearInterval(timer)
  }, [info?.status, load])

  const join = async () => {
    setJoining(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${apiUrl}/public/live-classes/${shareToken}/join`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ display_name: name }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) { setError(body?.error || 'Could not join this class'); if (response.status === 401 || body?.code === 'AUTH_REQUIRED') window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`; if (response.status === 409) void load(); return }
      setJoined(body.data)
    } catch { setError('Could not reach Kanvise. Check your connection and try again.') } finally { setJoining(false) }
  }

  if (joined) return <ClientClassroom token={joined.access_token} serverUrl={joined.livekit_url} roomName={joined.livekit_room_name} classId={`shared-${shareToken}`} isHost={false} classTitle={joined.class_title} courseName={null} guestShareToken={shareToken} />
  const unavailable = info?.status === 'completed' || info?.status === 'cancelled' || info?.status === 'revoked'
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans"><section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 shadow-sm">
    <div className="flex items-center gap-3">{info?.centre_logo_url ? <img src={info.centre_logo_url} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eeeaff] text-[#2e2877]"><span className="material-symbols-outlined">school</span></div>}<div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#994704]">{info?.centre_name || 'Kanvise'}</p><h1 className="text-xl font-bold text-[#180d62]">{info?.title || 'Loading class…'}</h1></div></div>
    {unavailable ? <p className="mt-6 text-sm leading-6 text-[#66616c]">This class has ended. Ask your tutor for their next class link.</p> : info?.status === 'scheduled' ? <p className="mt-6 text-sm leading-6 text-[#66616c]">Your tutor has not started this class yet. Keep this page open—we’ll let you in when it begins.</p> : info?.access_mode === 'enrolled_learners' ? <><p className="mt-6 text-sm leading-6 text-[#66616c]">This class is for enrolled learners. {signedIn ? 'Your account will be checked before you join.' : 'Sign in with your learner account to join.'}</p><button type="button" onClick={() => { if (signedIn) void join(); else window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}` }} disabled={joining} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:opacity-50">{joining ? 'Joining classroom…' : signedIn ? 'Join class' : 'Sign in to join'}</button></> : <><p className="mt-6 text-sm leading-6 text-[#66616c]">Enter your name to join. You do not need an account.</p><label className="mt-5 block text-sm font-semibold text-[#1b1c1c]">Your name<input value={name} onChange={event => setName(event.target.value)} maxLength={60} autoComplete="name" className="mt-2 min-h-12 w-full rounded-lg border border-[#8b8580] px-3 font-normal" placeholder="e.g. Emmanuel" /></label><button type="button" onClick={() => void join()} disabled={joining || name.trim().length < 2} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white disabled:opacity-50">{joining ? 'Joining classroom…' : 'Join class'}</button></>}
    {error ? <p role="alert" className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}
  </section></main>
}

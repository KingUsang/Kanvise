import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClientClassroom from './ClientClassroom'
import PreparingClassroom from './PreparingClassroom'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ start?: string }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const classId = resolvedParams.id
  const isStarting = resolvedSearchParams.start === 'true' // Tutor provides ?start=true

  // ── 1. Get the authenticated user's session from the cookie ────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // Server component, cannot set cookies
      },
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    // ── No session: check if this class allows public access ──────────────────
    const honoUrl = process.env.NEXT_PUBLIC_API_URL
    let classInfo: { title: string; status: string; access_mode: string; centre_name: string; centre_logo_url: string | null } | null = null
    try {
      const res = await fetch(`${honoUrl}/public/live-classes/by-id/${classId}`, { cache: 'no-store' })
      if (res.ok) classInfo = (await res.json()).data
    } catch { /* classInfo stays null */ }

    // Class not found at all
    if (!classInfo) {
      return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
          <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <span className="text-2xl">!</span>
            </div>
            <h1 className="text-xl font-bold text-[#180d62]">Class not found</h1>
            <p className="mt-3 text-sm leading-6 text-[#66616c]">This class link is invalid or has been removed.</p>
          </section>
        </main>
      )
    }

    // Class is for enrolled learners only — show friendly message, no login redirect
    if (classInfo.access_mode === 'enrolled_learners') {
      return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
          <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              {classInfo.centre_logo_url
                ? <img src={classInfo.centre_logo_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eeeaff] text-[#2e2877]"><span className="material-symbols-outlined">school</span></div>
              }
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#994704]">{classInfo.centre_name}</p>
                <h1 className="text-xl font-bold text-[#180d62]">{classInfo.title}</h1>
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-[#fff8f0] border border-[#f5d9b8] p-4">
              <p className="text-sm font-semibold text-[#7f3a03]">This class is for enrolled learners only</p>
              <p className="mt-1 text-sm leading-6 text-[#66616c]">You need to be a registered student at <strong>{classInfo.centre_name}</strong> to join this class. Ask your tutor to add you to their school on Kanvise.</p>
            </div>
          </section>
        </main>
      )
    }

    // Class is open to anyone — render the guest join UI (client component)
    const { GuestClassEntry } = await import('./GuestClassEntry')
    return <GuestClassEntry classId={classId} classInfo={classInfo} />
  }

  // ── 2. Call Hono to get the LiveKit token ──────────────────────────────────
  // Tutors navigate with ?start=true to create and start the room.
  // Everyone else calls /join which expects the room to already be live.

  const honoUrl = process.env.NEXT_PUBLIC_API_URL
  const endpoint = isStarting
    ? `${honoUrl}/live-classes/${classId}/start`
    : `${honoUrl}/live-classes/${classId}/join`

  let classData: {
    livekit_room_name: string
    access_token: string
    livekit_url: string
    is_host: boolean
    class_title: string
    course_name: string | null
  }
  let errorMessage: string | null = null
  let preparing: {
    retry_after_seconds?: number
    class_title?: string
    course_name?: string | null
    is_host?: boolean
  } | null = null

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      // next.js fetch cache: never cache a live class token
      cache: 'no-store',
    })

    const json = await response.json()

    if (response.status === 202 && json.data?.state === 'preparing') {
      preparing = json.data
    } else if (!response.ok) {
      errorMessage = json.error || `Failed to ${isStarting ? 'start' : 'join'} class (${response.status})`
    } else {
      classData = json.data
    }
  } catch {
    errorMessage = 'Could not reach the Kanvise API. Is the Hono server running?'
  }

  // ── 3. Render ──────────────────────────────────────────────────────────────

  if (preparing) {
    return <PreparingClassroom
      classId={classId}
      isStarting={isStarting}
      classTitle={preparing.class_title || 'Your live class'}
      courseName={preparing.course_name || null}
      isHost={preparing.is_host ?? isStarting}
    />
  }

  if (errorMessage || !classData!) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbf9f8] font-sans">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h2 className="text-[#180d62] font-bold text-lg mb-2">Cannot Join Class</h2>
          <p className="text-[#787582] text-sm">{errorMessage}</p>
          <Link href="/dashboard" className="mt-5 inline-flex rounded-lg bg-[#180d62] px-4 py-2 text-sm font-semibold text-white">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isHost = classData!.is_host === true // The backend securely confirms if they are the host

  return (
    <ClientClassroom
      token={classData!.access_token}
      serverUrl={classData!.livekit_url}
      roomName={classData!.livekit_room_name}
      classId={classId}
      isHost={isHost}
      classTitle={classData!.class_title}
      courseName={classData!.course_name}
    />
  )
}

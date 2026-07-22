import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import ClientClassroom from './ClientClassroom'

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
    redirect('/auth/login')
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
    course_code: string | null
  }
  let errorMessage: string | null = null

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

    if (!response.ok) {
      errorMessage = json.error || `Failed to ${isStarting ? 'start' : 'join'} class (${response.status})`
    } else {
      classData = json.data
    }
  } catch {
    errorMessage = 'Could not reach the Kanvise API. Is the Hono server running?'
  }

  // ── 3. Render ──────────────────────────────────────────────────────────────

  if (errorMessage || !classData!) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbf9f8] font-sans">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h2 className="text-[#180d62] font-bold text-lg mb-2">Cannot Join Class</h2>
          <p className="text-[#787582] text-sm">{errorMessage}</p>
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
      courseCode={classData!.course_code}
    />
  )
}

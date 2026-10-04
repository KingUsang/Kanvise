import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
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

    // Guest access requires the opaque link, never a guessable class id. This
    // prevents a public route from becoming an alternate access control path.
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
        <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 shadow-sm text-center">
          <h1 className="text-xl font-bold text-[#180d62]">Use the class link</h1>
          <p className="mt-3 text-sm leading-6 text-[#66616c]">Ask your tutor for the shared class link to join this preview.</p>
        </section>
      </main>
    )
  }

  // Start and join are intentionally client-side. PlugNMeet can cold-start,
  // and awaiting that request in this server component strands the visitor on
  // Next's non-interactive route fallback. PreparingClassroom owns readiness,
  // retries and the eventual handoff to the provider UI.
  return <PreparingClassroom
    classId={classId}
    isStarting={isStarting}
    classTitle="Your live class"
    courseName={null}
    isHost={isStarting}
    studentName={session.user.user_metadata?.first_name || 'Tutor'}
    studentId={session.user.id}
  />
}

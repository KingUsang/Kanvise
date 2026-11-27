import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import PreparingClassroom from './PreparingClassroom'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ share_token?: string | string[] }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const rawToken = (await searchParams)?.share_token
  const shareToken = typeof rawToken === 'string' && /^[A-Za-z0-9_-]{10,24}$/.test(rawToken) ? rawToken : ''
  const classId = resolvedParams.id

  // ── 1. Verify the authenticated user's claims from the cookie ──────────────
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

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  if (claimsError || !claims) {
    // ── No session: check if this class allows public access ──────────────────
    // A bare class id is not a capability. A visitor with the opaque link goes
    // to the shared-link page; anyone else is asked to sign in or use the link.
    if (shareToken) redirect(`/live/${shareToken}`)

    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf9f8] px-5 font-sans">
        <section className="w-full max-w-md rounded-2xl border border-[#e5e1dd] bg-white p-7 shadow-sm text-center">
          <h1 className="text-xl font-bold text-[#180d62]">Use the class link or sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[#66616c]">Ask your tutor for the shared class link, or sign in to join a class you are enrolled in.</p>
          <Link href="/auth/login" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#994704] px-5 text-sm font-semibold text-white">Sign in</Link>
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
    classTitle="Your live class"
    courseName={null}
  />
}

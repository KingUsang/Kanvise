import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MockResultsClient } from '@/components/dashboard/mocks/mock-results-client'

export const metadata = { title: 'Mock Results | Kanvise' }

export default async function MockResultsPage({ params }: { params: Promise<{ mockId: string }> }) {
  const { mockId } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  return <MockResultsClient mockId={mockId} token={session.access_token} />
}

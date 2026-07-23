import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { QuestionBanksClient } from '@/components/dashboard/question-banks/question-banks-client'

export const metadata = { title: 'Question Banks | Kanvise' }

export default async function QuestionBanksPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()
  if (!user || !session?.access_token) redirect('/auth/login')

  const role = user.app_metadata?.kanvise_role || user.app_metadata?.role || user.user_metadata?.kanvise_role
  if (!['admin', 'tutor'].includes(role)) redirect('/dashboard')

  return <QuestionBanksClient token={session.access_token} />
}

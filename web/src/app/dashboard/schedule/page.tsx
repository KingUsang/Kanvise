import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ScheduleClient } from '@/components/dashboard/schedule/schedule-client'
import { getApiUrl } from '@/config/api'

export default async function SchedulePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    redirect('/auth/login')
  }

  // Fetch capabilities to know if admin/tutor
  const res = await fetch(`${getApiUrl()}/dashboard/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    cache: 'no-store'
  })

  if (!res.ok) {
    throw new Error('Failed to fetch user capabilities')
  }

  const { data: statsData } = await res.json()
  const capabilities = {
    isAdmin: !!statsData.admin_stats,
    isTutor: !!statsData.tutor_stats
  }

  const userInfo = {
    id: user.id,
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
  }

  return (
    <div className="animate-in fade-in duration-500">
      <ScheduleClient token={token} capabilities={capabilities} user={userInfo} />
    </div>
  )
}

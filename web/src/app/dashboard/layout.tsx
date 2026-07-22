import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardShell } from "@/components/dashboard/shell";
import { getApiUrl } from '@/config/api'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Get auth token for Hono API calls
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    redirect('/auth/login')
  }

  // app_metadata is server-controlled and authoritative. user_metadata is a
  // temporary display/redirect fallback for sessions issued before migration.
  const role = user.app_metadata?.kanvise_role || user.app_metadata?.role || user.user_metadata?.kanvise_role || 'student'

  // Student pages provide their own navigation shell. Avoid loading the
  // admin/tutor dashboard endpoint for a role it was not designed to serve.
  if (role === 'student') {
    return <div className="font-sans">{children}</div>
  }

  // Fetch capabilities and basic user info from Hono stats endpoint
  // We do this to determine if the user is a tutor based on their assignments
  const res = await fetch(`${getApiUrl()}/dashboard/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    // Don't cache this request as capabilities might change
    cache: 'no-store'
  })

  if (!res.ok) {
    // If the stats endpoint fails (e.g. user has no school), they shouldn't be in the dashboard
    if (res.status === 400 || res.status === 403) {
      redirect('/join')
    }
    throw new Error('Failed to fetch dashboard data')
  }

  const { data: statsData } = await res.json()
  
  const capabilities = {
    isAdmin: !!statsData.admin_stats,
    isTutor: !!statsData.tutor_stats
  }

  const userInfo = {
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
    role: role
  }

  return (
    <div className="font-sans">
      <DashboardShell user={userInfo} capabilities={capabilities}>
        {children}
      </DashboardShell>
    </div>
  )
}

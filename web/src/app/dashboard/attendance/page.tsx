import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AttendanceClient } from '@/components/dashboard/attendance/attendance-client'

export const metadata = {
  title: 'Attendance | Kanvise',
}

export default async function AttendancePage() {
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

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    redirect('/auth/login')
  }

  return (
    <div className="animate-in fade-in duration-500">
      <AttendanceClient token={token} />
    </div>
  )
}

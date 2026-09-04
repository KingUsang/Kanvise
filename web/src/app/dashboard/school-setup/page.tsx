import { createClient } from '@/lib/supabase/server'
import { SchoolSetupForm } from '@/components/dashboard/setup/school-setup-form'
import { redirect } from 'next/navigation'
import { getApiUrl } from '@/config/api'

export default async function SchoolSetupPage() {
  const supabase = await createClient()

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) return redirect('/auth/login')

  // Fetch school data
  const res = await fetch(`${getApiUrl()}/schools/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    cache: 'no-store'
  })

  const responseBody = await res.json().catch(() => null)
  const isNewAdmin = !res.ok && (
    responseBody?.code === 'SCHOOL_NOT_CONFIGURED'
    || (res.status === 400 && responseBody?.error === 'User does not belong to a school')
  )

  if (!res.ok && !isNewAdmin) {
    return (
      <div className="p-8 text-center text-red-500">
        We could not load your centre details. Please refresh the page and try again.
      </div>
    )
  }

  // A missing centre is the expected first-login state for an Admin. Passing
  // null opens the creation form, which submits to POST /schools.
  const schoolData = res.ok ? responseBody?.data : null

  return (
    <div className="animate-in fade-in duration-500">
      <SchoolSetupForm initialData={schoolData} token={token} />
    </div>
  )
}

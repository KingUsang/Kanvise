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

  if (!res.ok && res.status !== 400) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load school profile.
      </div>
    )
  }

  const schoolData = res.ok ? (await res.json()).data : null

  return (
    <div className="animate-in fade-in duration-500">
      <SchoolSetupForm initialData={schoolData} token={token} />
    </div>
  )
}

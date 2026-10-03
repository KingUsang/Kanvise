import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getApiUrl } from '@/config/api'
import { SchoolSetupForm } from '@/components/dashboard/setup/school-setup-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const response = await fetch(`${getApiUrl()}/schools/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) redirect('/dashboard/school-setup')

  return <div className="animate-in fade-in duration-500"><SchoolSetupForm initialData={body?.data} token={session.access_token} /></div>
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LegacyAccountSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=%2Faccount%2Fsetup')
  const role = user.app_metadata?.kanvise_role || user.app_metadata?.role
  redirect(role === 'student' ? '/dashboard/student/settings' : role === 'admin' ? '/dashboard/settings' : '/dashboard/profile')
}

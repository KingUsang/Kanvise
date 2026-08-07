import { redirect } from 'next/navigation'
import { TelegramSetupClient } from '@/components/dashboard/telegram/telegram-setup-client'
import { requireServerAccessToken } from '@/lib/server-session'
import { createClient } from '@/lib/supabase/server'

export default async function TelegramPage() {
  const token = await requireServerAccessToken()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.kanvise_role || user?.app_metadata?.role
  if (role !== 'admin') redirect('/dashboard')
  return <TelegramSetupClient token={token} />
}

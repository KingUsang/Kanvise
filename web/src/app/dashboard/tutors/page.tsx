import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TutorsClient } from '@/components/dashboard/tutors/tutors-client'

export default async function TutorsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/')

  return (
    <div className="mx-auto w-full max-w-[1440px] animate-in fade-in duration-500">
      <TutorsClient />
    </div>
  )
}

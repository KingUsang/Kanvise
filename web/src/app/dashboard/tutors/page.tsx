import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TutorsClient } from '@/components/dashboard/tutors/tutors-client'

export default async function TutorsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/')

  // Next.js Middleware handles the role-based route protection by reading kanvise_role
  // from the JWT user_metadata. No database lookup is needed here.

  return (
    <div className="animate-in fade-in duration-500">
      <TutorsClient />
    </div>
  )
}

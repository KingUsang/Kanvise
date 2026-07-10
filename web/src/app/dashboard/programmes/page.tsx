import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProgrammesClient } from '@/components/dashboard/programmes/programmes-client'

export default async function ProgrammesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  // Next.js Middleware handles role protection. 
  // school_id is available in the JWT metadata.
  const schoolId = session.user.user_metadata?.school_id

  return (
    <div className="animate-in fade-in duration-500">
      <ProgrammesClient schoolId={schoolId} />
    </div>
  )
}

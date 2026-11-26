import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotesClient } from '@/components/dashboard/notes/notes-client'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: claimsData, error } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  if (error || !claims) {
    redirect('/')
  }

  // Next.js Middleware handles role protection.
  const role = claims.app_metadata?.kanvise_role || claims.app_metadata?.role

  if (role !== "admin" && role !== "tutor") {
     redirect('/dashboard') // Students can't access this page yet, though they can fetch notes in their view.
  }

  const profileId = typeof claims.app_metadata?.profile_id === 'string'
    ? claims.app_metadata.profile_id
    : null

  return (
    <div className="animate-in fade-in duration-500 h-full">
      <NotesClient role={role} profileId={profileId} />
    </div>
  )
}

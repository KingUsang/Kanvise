import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotesClient } from '@/components/dashboard/notes/notes-client'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  // Next.js Middleware handles role protection.
  const schoolId = session.user.user_metadata?.school_id
  const role = session.user.user_metadata?.role

  if (role !== "admin" && role !== "tutor") {
     redirect('/dashboard') // Students can't access this page yet, though they can fetch notes in their view.
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      <NotesClient schoolId={schoolId} session={session} />
    </div>
  )
}

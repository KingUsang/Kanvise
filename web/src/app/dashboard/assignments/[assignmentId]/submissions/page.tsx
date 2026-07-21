import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubmissionsClient } from '@/components/dashboard/assignments/submissions-client'

export default async function SubmissionsPage({
  params
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  // Next.js Middleware handles role protection.
  const role = session.user.user_metadata?.kanvise_role

  if (role !== "admin" && role !== "tutor") {
     redirect('/dashboard') // Students can't access this page
  }

  // In Next.js 15, params is a Promise, so we must await it.
  const { assignmentId } = await params

  return (
    <div className="h-full">
      <SubmissionsClient assignmentId={assignmentId} session={session} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TutorsClient } from '@/components/dashboard/tutors/tutors-client'

export default async function TutorsPage() {
  const supabase = await createClient()
  const { data: claimsData, error } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  if (error || !claims) redirect('/')

  return (
    <div className="mx-auto w-full max-w-[1440px] animate-in fade-in duration-500">
      <TutorsClient />
    </div>
  )
}

import { GuestAttemptPageClient } from '@/components/mock-access/guest-attempt-page-client'

export default async function GuestAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  return <GuestAttemptPageClient attemptId={attemptId} />
}

import { GuestResultPageClient } from '@/components/mock-access/guest-result-page-client'

export default async function GuestResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  return <GuestResultPageClient attemptId={attemptId} />
}

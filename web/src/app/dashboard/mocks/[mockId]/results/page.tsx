import { MockResultsClient } from '@/components/dashboard/mocks/mock-results-client'

export const metadata = { title: 'Quiz Results | Kanvise' }

// The dashboard layout already verifies the session and redirects signed-out visitors.
export default async function MockResultsPage({ params }: { params: Promise<{ mockId: string }> }) {
  const { mockId } = await params
  return <MockResultsClient mockId={mockId} />
}

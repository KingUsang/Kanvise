import { StudentMocksClient } from '@/components/student/student-mocks-client'

export default async function StudentMocksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === 'unlocked' ? 'unlocked' : 'programme'
  return <StudentMocksClient initialView={view} />
}

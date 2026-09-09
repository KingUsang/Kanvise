import { StudentMocksClient } from '@/components/student/student-mocks-client'
import { getStudentMocks, getUnlockedMocks } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function StudentMocksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const token = await requireServerAccessToken()
  const [groups, unlocked] = await Promise.all([getStudentMocks(token), getUnlockedMocks(token)])
  const view = (await searchParams).view === 'unlocked' ? 'unlocked' : 'programme'
  return <StudentMocksClient groups={groups} unlocked={unlocked} initialView={view} />
}

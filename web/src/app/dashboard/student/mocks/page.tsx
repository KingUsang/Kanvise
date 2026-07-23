import { StudentMocksClient } from '@/components/student/student-mocks-client'
import { getStudentMocks } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function StudentMocksPage() {
  const token = await requireServerAccessToken()
  return <StudentMocksClient groups={await getStudentMocks(token)} />
}

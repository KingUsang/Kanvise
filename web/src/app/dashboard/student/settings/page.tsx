import { StudentSettingsClient } from '@/components/student/student-settings-client'
import { getStudentSettings } from '@/lib/student-settings'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function StudentSettingsPage() {
  const token = await requireServerAccessToken()
  return <StudentSettingsClient settings={await getStudentSettings(token)} token={token} />
}

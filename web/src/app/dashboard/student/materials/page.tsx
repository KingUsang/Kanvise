import { StudentMaterialsClient } from '@/components/student/student-materials-client'
import { getStudentMaterials } from '@/lib/student-materials'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function StudentMaterialsPage() {
  const token = await requireServerAccessToken()
  return <StudentMaterialsClient materials={await getStudentMaterials(token)} />
}

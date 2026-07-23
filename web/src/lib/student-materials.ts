import { getApiUrl } from '@/config/api'

export type StudentMaterial = {
  id: string; title: string; description: string | null; file_name: string; file_type: string;
  file_size_bytes: number; created_at: string; course_id: string; download_url: string;
  course: { id: string; name: string } | null;
  tutor: { id: string; first_name: string; last_name: string } | null;
}

export async function getStudentMaterials(accessToken: string): Promise<StudentMaterial[]> {
  const response = await fetch(`${getApiUrl()}/notes/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load learning materials')
  return body.data || []
}

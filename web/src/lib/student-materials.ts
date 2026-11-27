import { fetchAllPages } from '@/lib/fetch-all-pages'
import { getApiUrl } from '@/config/api'

export type StudentMaterial = {
  id: string; title: string; description: string | null; file_name: string; file_type: string;
  file_size_bytes: number; created_at: string; course_id: string; download_url: string | null; download_available: boolean;
  course: { id: string; name: string } | null;
  tutor: { id: string; first_name: string; last_name: string } | null;
}

export async function getStudentMaterials(accessToken: string): Promise<StudentMaterial[]> {
  return fetchAllPages<StudentMaterial>(
    (page) => fetch(`${getApiUrl()}/notes/me?page=${page}&page_size=100`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }),
    'Could not load learning materials',
  )
}

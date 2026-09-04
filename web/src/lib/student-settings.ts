import { getApiUrl } from '@/config/api'

export type StudentSettings = {
  profile: { id: string; kanvise_user_id: string; first_name: string; last_name: string; email: string; bio: string | null; profile_photo_url: string | null }
  school: { id: string; name: string } | null
}

export async function getStudentSettings(accessToken: string): Promise<StudentSettings> {
  const response = await fetch(`${getApiUrl()}/students/me/settings`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load your settings')
  return body.data
}

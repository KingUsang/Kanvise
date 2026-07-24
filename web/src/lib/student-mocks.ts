import { getApiUrl } from '@/config/api'

export type StudentMockCard = {
  id: string
  source?: 'centre' | 'marketplace'
  marketplace_listing_id?: string
  title: string
  description: string | null
  course_id: string | null
  course: { name: string } | null
  available_from: string | null
  closes_at: string | null
  time_limit_minutes: number
  calculator_mode: 'none' | 'basic' | 'scientific'
  attempts_used: number
  attempts_allowed: number
  version: { id: string; total_questions: number; total_marks: number }
  attempt?: { id: string; status: string; deadline_at: string | null; submitted_at: string | null; total_score: number | null; total_marks: number | null }
}

export type StudentMockGroups = {
  available: StudentMockCard[]
  in_progress: StudentMockCard[]
  upcoming: StudentMockCard[]
  completed: StudentMockCard[]
}

async function api<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load this page')
  return body.data
}

export function getStudentMocks(accessToken: string) {
  return api<StudentMockGroups>('/students/me/mocks', accessToken)
}

export function getMockPreflight(mockId: string, accessToken: string) {
  return api<any>(`/mocks/${mockId}/preflight`, accessToken)
}

export function getStudentAttempt(attemptId: string, accessToken: string) {
  return fetch(`${getApiUrl()}/attempts/${attemptId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  }).then(async response => {
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error || 'Could not load your attempt')
    return { ...body.data, server_now: body.server_now }
  })
}

export function getStudentMockResult(attemptId: string, accessToken: string) {
  return api<any>(`/attempts/${attemptId}/results`, accessToken)
}

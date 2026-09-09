import { getApiUrl } from '@/config/api'

export async function createStudentRegistrationIntent(returnTo: string) {
  const response = await fetch(`${getApiUrl()}/auth/registration-intents/student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ return_to: returnTo }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.token) {
    throw new Error(body?.error || 'Could not start student registration')
  }
  return body.token as string
}

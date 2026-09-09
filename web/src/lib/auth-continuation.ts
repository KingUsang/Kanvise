import { safeRedirectPath } from './safe-redirect'

export type KanviseRole = 'admin' | 'tutor' | 'student'

type AuthDestinationInput = {
  role: KanviseRole
  schoolId?: string | null
  redirect?: string | null
}

export function defaultDestination(role: KanviseRole, schoolId?: string | null) {
  if (role === 'admin' && !schoolId) return '/dashboard/school-setup'
  return role === 'student' ? '/dashboard/student' : '/dashboard'
}

export function postAuthDestination({ role, schoolId, redirect }: AuthDestinationInput) {
  const fallback = defaultDestination(role, schoolId)
  const continuation = safeRedirectPath(redirect)
  if (!continuation) return fallback

  // A student may return to any safe in-app destination; the page and API
  // remain responsible for resource-level authorisation. Staff accounts only
  // retain invite acceptance, never a student purchase/attempt continuation.
  if (role === 'student' || continuation.startsWith('/join')) return continuation
  return fallback
}

type AuthHrefInput = {
  redirect?: string | null
  flow?: 'student' | 'centre' | null
  intent?: string | null
}

export function loginHref({ redirect, flow, intent }: AuthHrefInput = {}) {
  const params = new URLSearchParams()
  const safeRedirect = safeRedirectPath(redirect)
  if (safeRedirect) params.set('redirect', safeRedirect)
  if (flow) params.set('flow', flow)
  if (intent) params.set('intent', intent)
  const query = params.toString()
  return query ? `/auth/login?${query}` : '/auth/login'
}

export function studentRegisterHref({ redirect, intent }: Pick<AuthHrefInput, 'redirect' | 'intent'> = {}) {
  const params = new URLSearchParams()
  if (intent) params.set('intent', intent)
  const safeRedirect = safeRedirectPath(redirect)
  if (safeRedirect) params.set('return_to', safeRedirect)
  const query = params.toString()
  return query ? `/auth/register/student?${query}` : '/auth/register/student'
}

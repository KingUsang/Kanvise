import type { Context, Next } from 'hono'
import type { AccountContext } from '../types'
import { ACCOUNT_CONTEXT_HEADER, accountContextMiddleware } from './auth'

/**
 * Rewrites the request user so tenant and role come from the selected active
 * account membership verified by accountContextMiddleware, never from the
 * profile projection (DEV-SEC-004, DEV-SEC-005). It lets route bodies written
 * against `user.school_id` and `user.role` stay unchanged while every query is
 * scoped to the account the caller is actually a member of.
 *
 * Mount it immediately after accountContextMiddleware.
 */
export const accountUserProjection = async (c: Context, next: Next) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext | undefined
  if (!account) {
    return c.json({ error: 'Tutoring account context is required', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  }
  c.set('user', {
    ...user,
    school_id: account.id,
    role: account.role === 'learner' ? 'student' : account.role,
  })
  await next()
}

/**
 * For student endpoints that also serve standalone-mock students, who have no
 * tutoring account. Mirrors the dashboard exception: with no selected account
 * and no profile account, the request continues with no tenant. Any request
 * that names an account, or any profile that has one, must resolve the
 * selected active membership instead.
 */
export const standaloneAwareAccountContext = async (c: Context, next: Next) => {
  const user = c.get('user')
  const standalone = user?.role === 'student' && !user.school_id && !c.req.header(ACCOUNT_CONTEXT_HEADER)
  if (standalone) return next()
  return accountContextMiddleware(c, next)
}

export const standaloneAwareAccountProjection = async (c: Context, next: Next) => {
  if (!c.get('account')) return next()
  return accountUserProjection(c, next)
}

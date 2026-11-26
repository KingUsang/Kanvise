import type { Context, Next } from 'hono'
import type { AccountContext } from '../types'
import {
  ACCOUNT_CONTEXT_HEADER,
  accountContextMiddleware,
  accountContextUnavailable,
  accountSelectionRequired,
  lookupDefaultAccount,
  resolveAccountContext,
} from './auth'

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
 * tutoring account. With no header it applies the generic fallback of
 * accountContextMiddleware (one active membership is used, several need a
 * selection); a student with no membership and no profile account continues
 * with no tenant. Any request that names an account resolves that membership.
 */
export const standaloneAwareAccountContext = async (c: Context, next: Next) => {
  const user = c.get('user')
  if (user?.role === 'student' && c.req.header(ACCOUNT_CONTEXT_HEADER) === undefined) {
    const lookup = await lookupDefaultAccount(user.id)
    if (lookup.kind === 'error') return accountContextUnavailable(c)
    if (lookup.kind === 'several') return accountSelectionRequired(c)
    if (lookup.kind === 'single') return resolveAccountContext(c, next, lookup.accountId)
    if (!user.school_id) return next()
  }
  return accountContextMiddleware(c, next)
}

export const standaloneAwareAccountProjection = async (c: Context, next: Next) => {
  if (!c.get('account')) return next()
  return accountUserProjection(c, next)
}

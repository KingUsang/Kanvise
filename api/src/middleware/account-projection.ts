import type { Context, Next } from 'hono'
import type { AccountContext } from '../types'
import { supabase } from '../lib/supabase'
import { ACCOUNT_CONTEXT_HEADER, accountContextMiddleware, resolveAccountContext } from './auth'

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
 * tutoring account. With no header, a single active learner membership is used;
 * with none and no profile account the request continues with no tenant. Any
 * request that names an account resolves that active membership.
 */
export const standaloneAwareAccountContext = async (c: Context, next: Next) => {
  const user = c.get('user')
  if (user?.role === 'student' && !c.req.header(ACCOUNT_CONTEXT_HEADER)) {
    // Server-rendered student pages cannot read the browser's selected
    // account. Fall back to the learner's only active membership; a learner
    // with several must name one, and a learner with none and no profile
    // account is a standalone-mock student.
    const { data, error } = await supabase
      .from('account_memberships')
      .select('school_id')
      .eq('person_id', user.id)
      .eq('role', 'learner')
      .eq('status', 'active')
      .limit(2)
    if (error) {
      return c.json({ error: 'Could not verify the selected tutoring account', code: 'ACCOUNT_CONTEXT_UNAVAILABLE' }, 503)
    }
    if (data?.length === 1) return resolveAccountContext(c, next, data[0].school_id)
    if (!data?.length && !user.school_id) return next()
  }
  return accountContextMiddleware(c, next)
}

export const standaloneAwareAccountProjection = async (c: Context, next: Next) => {
  if (!c.get('account')) return next()
  return accountUserProjection(c, next)
}

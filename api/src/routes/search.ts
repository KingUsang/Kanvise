import { Hono } from 'hono'
import { z } from 'zod'
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  requireMembershipRole,
} from '../middleware/auth'
import { globalSearch, normaliseSearchTerm } from '../lib/global-search'
import { resolveReportingTimezone } from '../lib/reporting-period'
import type { AccountContext, TenantVariables } from '../types'

export const searchRouter = new Hono<{ Variables: TenantVariables }>()

// Long or odd input is not an error: it simply finds nothing (SH-05).
const searchQuerySchema = z.object({
  q: z.string().max(1_000).optional(),
  tz: z.string().max(64).optional(),
})

// GET /search?q=...: grouped results the caller may open in the active
// account. Account-scoped policy: verified person, active membership, staff role.
searchRouter.get(
  '/',
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  accountContextMiddleware,
  requireMembershipRole('admin', 'tutor'),
  async (c) => {
    const parsed = searchQuerySchema.safeParse({ q: c.req.query('q'), tz: c.req.query('tz') })
    const term = parsed.success ? normaliseSearchTerm(parsed.data.q) : null
    if (!term) return c.json({ data: { query: '', groups: [] } })

    const account = c.get('account') as AccountContext
    const user = c.get('user')
    const groups = await globalSearch({
      personId: user.id,
      accountId: account.id,
      role: account.role === 'admin' ? 'admin' : 'tutor',
      // Accounts have no stored timezone yet; the browser sends its own, as
      // GET /dashboard/summary does.
      timezone: resolveReportingTimezone(parsed.success ? parsed.data.tz : undefined),
    }, term)
    return c.json({ data: { query: term, groups } })
  },
)

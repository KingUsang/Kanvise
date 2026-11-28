import { Hono } from 'hono'
import { ApiError, uuidParam } from '../lib/api-contract'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'
import { releaseHeldMessageNow, undoHeldMessage, type HeldMessageDependencies } from '../notifications/held-messages'
import type { AccountContext, TenantVariables } from '../types'

/**
 * The Undo toast's two calls (18 NTF-03, 01 SH-08). Account-scoped: verified
 * person, active membership in the selected account. Only the person who acted
 * can undo or release their message; anything else is a 404, the same as a
 * message that doesn't exist, so nobody learns about another person's messages.
 */
export const heldMessagesRouter = new Hono<{ Variables: TenantVariables }>()

let dependencies: Partial<HeldMessageDependencies> = {}

/** Tests only. */
export function configureHeldMessageRoutes(next: Partial<HeldMessageDependencies>) {
  dependencies = next
}

const notFound = () => new ApiError(404, 'HELD_MESSAGE_NOT_FOUND', 'This message has already been sent or undone.')

heldMessagesRouter.post(
  '/:id/undo',
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  accountContextMiddleware,
  uuidParam('id'),
  async (c) => {
    const account = c.get('account') as AccountContext
    const undone = await undoHeldMessage({ id: c.req.param('id'), actorId: c.get('user').id, schoolId: account.id }, dependencies)
    if (!undone) throw notFound()
    return c.json({ data: { id: c.req.param('id'), status: 'cancelled' } })
  },
)

heldMessagesRouter.post(
  '/:id/release',
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  accountContextMiddleware,
  uuidParam('id'),
  async (c) => {
    const account = c.get('account') as AccountContext
    const released = await releaseHeldMessageNow({ id: c.req.param('id'), actorId: c.get('user').id, schoolId: account.id }, dependencies)
    if (!released) throw notFound()
    return c.json({ data: { id: c.req.param('id'), status: 'releasing' } })
  },
)

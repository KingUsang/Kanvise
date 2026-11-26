import { describe, expect, it, vi } from 'vitest'

const redirect = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_REDIRECT') }))
vi.mock('next/navigation', () => ({ redirect }))

import LegacyJoinPage from './page'
import LegacyCompleteTutorInvitePage from '../auth/complete-tutor-invite/page'

describe('retired legacy tutor invite pages', () => {
  it('/join redirects to /invite without forwarding the legacy token', () => {
    expect(() => LegacyJoinPage()).toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenLastCalledWith('/invite')
  })

  it('/auth/complete-tutor-invite redirects to /invite', () => {
    expect(() => LegacyCompleteTutorInvitePage()).toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenLastCalledWith('/invite')
  })
})

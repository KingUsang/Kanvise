import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))

import MorePage from './page'

describe('/dashboard/more', () => {
  it('redirects to the dashboard now that More is a phone sheet', () => {
    expect(() => MorePage()).toThrow('REDIRECT:/dashboard')
  })
})

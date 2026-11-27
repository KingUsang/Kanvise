import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }))
vi.mock('next/navigation', () => ({ redirect }))

import MockSlugPage from './mock/[slug]/page'
import GuestAttemptPage from './guest/attempt/[attemptId]/page'
import GuestResultPage from './guest/result/[attemptId]/page'
import MyMocksPage from './my-mocks/page'
import OffersPage from './dashboard/mocks/[mockId]/offers/page'

describe('retired Quiz pages', () => {
  it.each([
    ['/mock/:slug', MockSlugPage],
    ['/guest/attempt', GuestAttemptPage],
    ['/guest/result', GuestResultPage],
  ])('%s shows the retired message and links to the dashboard', (_name, Page) => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: 'This page has been retired' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to my dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it.each([
    ['/guest/attempt', GuestAttemptPage],
    ['/guest/result', GuestResultPage],
  ])('%s explains guest Quiz attempts are gone and guest live classes remain', (_name, Page) => {
    render(<Page />)
    expect(screen.getByText(/Guest Quiz attempts and results no longer exist/)).toBeInTheDocument()
    expect(screen.getByText(/join a live class/)).toBeInTheDocument()
  })

  it('/mock/:slug keeps the generic message', () => {
    render(<MockSlugPage />)
    expect(screen.getByText(/Standalone and public Quiz links no longer work/)).toBeInTheDocument()
  })

  it('/my-mocks redirects to the Class quiz list', async () => {
    await expect(MyMocksPage()).rejects.toThrow('REDIRECT:/dashboard/student/mocks')
  })

  it('the offers page redirects to the Quiz list', () => {
    expect(() => OffersPage()).toThrow('REDIRECT:/dashboard/mocks')
  })
})

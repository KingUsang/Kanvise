import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LandingPage from './page'

vi.mock('@/components/landing/AnimatedSection', () => ({
  AnimatedSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/landing/ImagineMockups', () => ({
  PaymentsMockup: () => null,
  ScheduleMockup: () => null,
  MockExamsMockup: () => null,
  LiveClassesMockup: () => null,
  MaterialsMockup: () => null,
}))

class ObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('landing waitlist', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ObserverStub)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ count: 0 }), { status: 200 })))
  })

  it('asks only for the identity needed to contact a centre', () => {
    render(<LandingPage />)

    expect(screen.getByRole('textbox', { name: 'Your name' })).toBeRequired()
    expect(screen.getByRole('textbox', { name: 'Work email' })).toBeRequired()
    expect(screen.getByRole('textbox', { name: 'Centre name' })).toBeRequired()
    expect(screen.queryByRole('textbox', { name: /phone/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /student/i })).not.toBeInTheDocument()
  })
})

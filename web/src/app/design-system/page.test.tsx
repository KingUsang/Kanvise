import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
  usePathname: () => '/design-system',
  useSearchParams: () => new URLSearchParams(),
}))

import DesignSystemPage from './page'

describe('design system catalog route', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is a 404 unless NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW is 1', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW', '')
    expect(() => DesignSystemPage()).toThrow('404')
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW', 'true')
    expect(() => DesignSystemPage()).toThrow('404')
  })

  it('renders the catalog when the flag is 1, with one h1 and a skip link', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW', '1')
    render(DesignSystemPage())
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})

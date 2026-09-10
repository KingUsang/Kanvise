import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockOffersManager, nextOfferSlug } from './mock-offers-manager'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('sonner', () => ({ toast }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))

describe('mock offer sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.kanvise.com')
  })

  it('finds the next available suggested link ending', () => {
    const offers = [
      { id: '1', slug: 'jamb-practice-2', access_mode: 'free_claim', price_kobo: 0, is_active: true },
      { id: '2', slug: 'jamb-practice', access_mode: 'free_claim', price_kobo: 0, is_active: true },
    ]
    expect(nextOfferSlug(offers, 'mock-id')).toBe('jamb-practice-3')
    expect(nextOfferSlug([], '12345678-abcd')).toBe('mock-12345678')
  })

  it('shows an existing link first and keeps additional-link settings secondary', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'offer-1', slug: 'jamb-practice', access_mode: 'free_claim', price_kobo: 0, is_active: true }],
      versions: [{ id: 'version-1', version_number: 1, total_questions: 40 }],
    }), { status: 200 })))

    render(<MockOffersManager mockId="mock-1" token="test-token" />)

    expect(await screen.findByRole('link', { name: 'https://staging.kanvise.com/mock/jamb-practice' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your mock links' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Link ending')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://staging.kanvise.com/mock/jamb-practice'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create another link' }))
    expect(screen.getByLabelText('Link ending')).toHaveValue('jamb-practice-2')
    expect(screen.getByRole('button', { name: 'Create link' })).toBeEnabled()
  })
})

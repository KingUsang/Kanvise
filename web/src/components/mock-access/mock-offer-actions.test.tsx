import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockOfferActions } from './mock-offer-actions'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getSession: vi.fn(),
  authenticatedFetch: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession: mocks.getSession } }) }))
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('MockOfferActions student journeys', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'student-token' } } })
  })

  it('starts a free public mock as a guest without forcing login', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: { attempt_id: 'guest-attempt-1' } }, 201))
    render(<MockOfferActions offerId="offer-1" slug="biology-basics" accessMode="free_claim" />)

    await userEvent.click(screen.getByRole('button', { name: 'Attempt mock' }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/guest/attempt/guest-attempt-1'))
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()
  })

  it('sends a signed-out paid buyer to student login with the exact mock continuation', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    render(<MockOfferActions offerId="offer-1" slug="biology-basics" accessMode="paid" />)

    await userEvent.click(screen.getByRole('button', { name: 'Buy and attempt mock' }))

    expect(mocks.push).toHaveBeenCalledWith('/auth/login?redirect=%2Fmock%2Fbiology-basics&flow=student')
  })

  it('stops a signed-in staff account before claim or checkout', async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce(jsonResponse({ user: { role: 'tutor' } }))
    render(<MockOfferActions offerId="offer-1" slug="biology-basics" accessMode="paid" />)

    await userEvent.click(screen.getByRole('button', { name: 'Buy and attempt mock' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Please use a student account to attempt this mock.'))
    expect(mocks.authenticatedFetch).toHaveBeenCalledOnce()
  })

  it('resumes an already-owned in-progress mock instead of trying to claim it again', async () => {
    mocks.authenticatedFetch
      .mockResolvedValueOnce(jsonResponse({ user: { role: 'student' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { attempts_used: 1, attempts_allowed: 2, resumable_attempt: { id: 'attempt-7' } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { attempt_id: 'attempt-7', resumed: true } }, 201))
    render(<MockOfferActions offerId="offer-1" slug="biology-basics" accessMode="paid" />)

    await userEvent.click(screen.getByRole('button', { name: 'Buy and attempt mock' }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/attempt/attempt-7'))
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(3)
    expect(String(mocks.authenticatedFetch.mock.calls[2][1])).toContain('/mock/offer-1/attempts')
  })

  it('explains exhausted access without creating another attempt', async () => {
    mocks.authenticatedFetch
      .mockResolvedValueOnce(jsonResponse({ user: { role: 'student' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { attempts_used: 2, attempts_allowed: 2, resumable_attempt: null } }))
    render(<MockOfferActions offerId="offer-1" slug="biology-basics" accessMode="free_claim" />)

    await userEvent.click(screen.getByRole('button', { name: 'Attempt mock' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('You have used all attempts included with this mock.'))
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(2)
  })

  it('claims a new free mock and opens its first attempt', async () => {
    mocks.authenticatedFetch
      .mockResolvedValueOnce(jsonResponse({ user: { role: 'student' } }))
      .mockResolvedValueOnce(jsonResponse({ code: 'MOCK_ENTITLEMENT_NOT_FOUND' }, 403))
      .mockResolvedValueOnce(jsonResponse({ data: { entitlement_id: 'entitlement-1' } }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: { attempt_id: 'attempt-1' } }, 201))
    render(<MockOfferActions offerId="offer-1" slug="biology-basics" accessMode="free_claim" />)

    await userEvent.click(screen.getByRole('button', { name: 'Attempt mock' }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/attempt/attempt-1'))
    expect(String(mocks.authenticatedFetch.mock.calls[2][1])).toContain('/mock/offer-1/claim')
    expect(String(mocks.authenticatedFetch.mock.calls[3][1])).toContain('/mock/offer-1/attempts')
  })
})

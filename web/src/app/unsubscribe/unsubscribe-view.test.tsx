import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <span data-alt={String(props.alt)} /> }))

import { UnsubscribeView } from './unsubscribe-view'

const TOKEN = 'A'.repeat(43)
type Answer = { status?: number; data?: unknown } | Error

function mockApi(answers: Record<string, Answer[]>) {
  const calls: Array<{ path: string; body: unknown; method: string }> = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.example.test', '')
    calls.push({ path, body: JSON.parse(String(init.body)), method: String(init.method) })
    const next = answers[path]?.shift()
    if (!next) throw new Error(`unexpected ${path}`)
    if (next instanceof Error) throw next
    return new Response(JSON.stringify({ data: next.data }), { status: next.status ?? 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const reminder = { state: 'subscribed', row_label: 'lesson reminder' }
const stopped = { state: 'unsubscribed', row_label: 'lesson reminder' }

describe('unsubscribe page (NTF-04, NTF-08)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', `/unsubscribe?token=${TOKEN}`)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('only looks the link up on load, then unsubscribes when the button is pressed', async () => {
    const calls = mockApi({ '/unsubscribe/lookup': [{ data: reminder }], '/unsubscribe': [{ data: stopped }] })
    render(<UnsubscribeView />)
    expect(screen.getByRole('status', { name: 'Loading your email settings' })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Stop lesson reminder emails?' })).toBeTruthy()
    expect(calls).toEqual([{ path: '/unsubscribe/lookup', body: { token: TOKEN }, method: 'POST' }])

    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))
    expect(await screen.findByRole('heading', { name: "You won't get lesson reminder emails any more." })).toBeTruthy()
    expect(calls.map((call) => call.path)).toEqual(['/unsubscribe/lookup', '/unsubscribe'])
    expect(screen.queryByText(/Manage notifications/)).toBeNull()
  })

  it('takes the token out of the address bar and keeps it for a reload', async () => {
    mockApi({ '/unsubscribe/lookup': [{ data: reminder }] })
    render(<UnsubscribeView />)
    await screen.findByRole('heading', { name: 'Stop lesson reminder emails?' })
    expect(window.location.search).toBe('')
    expect(window.sessionStorage.getItem('kanvise-unsubscribe-token')).toBe(TOKEN)
  })

  it('Undo switches the emails back on', async () => {
    const calls = mockApi({ '/unsubscribe/lookup': [{ data: stopped }], '/unsubscribe/undo': [{ data: reminder }] })
    render(<UnsubscribeView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('heading', { name: "You'll get lesson reminder emails again." })).toBeTruthy()
    expect(calls.at(-1)).toEqual({ path: '/unsubscribe/undo', body: { token: TOKEN }, method: 'POST' })
  })

  it('shows the expired message with Sign in', async () => {
    mockApi({ '/unsubscribe/lookup': [{ data: { state: 'expired' } }] })
    render(<UnsubscribeView />)
    expect(await screen.findByRole('heading', { name: 'This link has expired.' })).toBeTruthy()
    expect(screen.getByText('Sign in to manage your notifications.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth/login')
  })

  it('treats a page with no token as expired without calling the API', async () => {
    window.history.replaceState(null, '', '/unsubscribe')
    const calls = mockApi({})
    render(<UnsubscribeView />)
    expect(await screen.findByRole('heading', { name: 'This link has expired.' })).toBeTruthy()
    expect(calls).toEqual([])
  })

  it('shows the error with Try again, which looks the link up again', async () => {
    mockApi({ '/unsubscribe/lookup': [new Error('offline'), { data: reminder }] })
    render(<UnsubscribeView />)
    expect(await screen.findByRole('heading', { name: "We couldn't update this." })).toBeTruthy()
    expect(screen.getByText('Try again in a moment.')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Stop lesson reminder emails?' })).toBeTruthy())
  })

  it('shows an error when the API answers with a failure', async () => {
    mockApi({ '/unsubscribe/lookup': [{ data: reminder }], '/unsubscribe': [{ status: 429, data: undefined }] })
    render(<UnsubscribeView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }))
    expect(await screen.findByRole('heading', { name: "We couldn't update this." })).toBeTruthy()
  })

  it('preview states render without calling the API', () => {
    const calls = mockApi({})
    render(<UnsubscribeView preview="success" previewLabel="quiz" />)
    expect(screen.getByRole('heading', { name: "You won't get quiz emails any more." })).toBeTruthy()
    expect(calls).toEqual([])
  })
})

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, createSaveQueue, type SendResult } from '@/lib/offline/save-queue'
import { useAutosaveField } from '@/lib/offline/use-autosave-field'
import { ConflictBanner } from './conflict-banner'
import { OFFLINE_BANNER_COPY, OfflineBanner, uploadingCopy, useOfflineBanner } from './offline-banner'
import { OnlineOnlyButton } from './online-only-button'
import { SaveStatus } from './save-status'

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

afterEach(() => {
  cleanup()
  setOnline(true)
  vi.useRealTimers()
})

describe('SaveStatus', () => {
  it('shows each SH-13 state with the exact copy', () => {
    const { rerender } = render(<SaveStatus state="saving" />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()

    rerender(<SaveStatus state="saved" savedAt={new Date('2026-11-28T16:12:00')} />)
    const saved = screen.getByRole('button', { name: 'Saved at 4:12 PM' })
    expect(saved).toHaveTextContent(/^Saved$/)
    fireEvent.focus(saved)
    expect(saved).toHaveTextContent('Saved at 4:12 PM')
    fireEvent.blur(saved)
    expect(saved).toHaveTextContent(/^Saved$/)

    rerender(<SaveStatus state="saved-on-device" />)
    expect(screen.getByText("Saved on this device. It will upload when you're back online.", { selector: 'span' })).toBeInTheDocument()

    const onRetry = vi.fn()
    rerender(<SaveStatus state="couldnt-save" onRetry={onRetry} />)
    expect(screen.getByText("Couldn't save.", { selector: 'span' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('announces only "Saved on this device" and "Couldn\'t save"', () => {
    const { rerender } = render(<SaveStatus state="idle" />)
    const region = screen.getByRole('status')
    rerender(<SaveStatus state="saving" />)
    expect(region).toHaveTextContent('')
    rerender(<SaveStatus state="saved" savedAt={new Date()} />)
    expect(region).toHaveTextContent('')
    rerender(<SaveStatus state="saved-on-device" />)
    expect(region).toHaveTextContent("Saved on this device. It will upload when you're back online.")
    // Typing again while offline does not repeat it.
    rerender(<SaveStatus state="saved-on-device" />)
    expect(region).toHaveTextContent("Saved on this device. It will upload when you're back online.")
    rerender(<SaveStatus state="saving" />)
    expect(region).toHaveTextContent('')
    rerender(<SaveStatus state="couldnt-save" onRetry={() => undefined} />)
    expect(region).toHaveTextContent("Couldn't save.")
  })
})

describe('ConflictBanner', () => {
  it('shows both versions and both choices', () => {
    const keep = vi.fn()
    const newer = vi.fn()
    render(<ConflictBanner mine="My plan" theirs="Their plan" onKeepMine={keep} onUseNewer={newer} />)
    expect(screen.getByText('This changed while you were offline.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your version' })).toHaveTextContent('My plan')
    expect(screen.getByRole('region', { name: 'The newer version' })).toHaveTextContent('Their plan')
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use the newer version' }))
    expect(keep).toHaveBeenCalled()
    expect(newer).toHaveBeenCalled()
  })
})

describe('OfflineBanner', () => {
  it('uses the spec copy and says change or changes', () => {
    expect(uploadingCopy(1)).toBe('Back online. Uploading 1 change…')
    expect(uploadingCopy(2)).toBe('Back online. Uploading 2 changes…')
    const { rerender } = render(<OfflineBanner mode="offline" count={0} />)
    expect(screen.getByRole('status')).toHaveTextContent(OFFLINE_BANNER_COPY)
    expect(OFFLINE_BANNER_COPY).toBe("You're offline. Changes are saved on this device and will upload when you're back.")
    rerender(<OfflineBanner mode="reconnecting" count={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Back online. Uploading 2 changes…')
    rerender(<OfflineBanner mode={null} count={0} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows the uploading line only after being offline, until nothing is left', () => {
    const { result, rerender } = renderHook(({ online, uploading }) => useOfflineBanner(online, uploading), {
      initialProps: { online: true, uploading: 1 },
    })
    // Normal saving while online shows no banner.
    expect(result.current.mode).toBeNull()
    rerender({ online: false, uploading: 2 })
    expect(result.current.mode).toBe('offline')
    rerender({ online: true, uploading: 2 })
    expect(result.current).toEqual({ mode: 'reconnecting', count: 2 })
    rerender({ online: true, uploading: 1 })
    expect(result.current).toEqual({ mode: 'reconnecting', count: 1 })
    rerender({ online: true, uploading: 0 })
    expect(result.current.mode).toBeNull()
    rerender({ online: true, uploading: 1 })
    expect(result.current.mode).toBeNull()
  })
})

describe('OnlineOnlyButton', () => {
  it('is disabled offline with the reason under it', () => {
    const reason = "You're offline. You can complete this summary when you're back online."
    render(<OnlineOnlyButton offlineReason={reason}>Complete</OnlineOnlyButton>)
    expect(screen.getByRole('button', { name: 'Complete' })).toBeEnabled()
    act(() => setOnline(false))
    const button = screen.getByRole('button', { name: 'Complete' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(reason)
    act(() => setOnline(true))
    expect(screen.getByRole('button', { name: 'Complete' })).toBeEnabled()
  })
})

describe('useAutosaveField', () => {
  it('goes from Saving to Saved after the server confirms, and restores a device draft', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorage()
    const queue = createSaveQueue({ storage, isOnline: () => true })
    queue.setScope({ personId: 'p-1', accountId: 'a-1' })
    const sender = vi.fn(async (): Promise<SendResult> => ({ ok: true, version: 2 }))
    const { result, unmount } = renderHook(() => useAutosaveField({ recordKey: 'demo:1', field: 'text', initialValue: '', baseVersion: 1, sender, queue }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    act(() => result.current.setValue('Hello'))
    expect(result.current.value).toBe('Hello')
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.state).toBe('saving')
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(sender).toHaveBeenCalledWith({ recordKey: 'demo:1', field: 'text', value: 'Hello', baseVersion: 1 })
    expect(result.current.state).toBe('saved')
    expect(result.current.savedAt).toBeInstanceOf(Date)
    unmount()

    // A change left on the device (no connection) comes back after a reload.
    const offlineQueue = createSaveQueue({ storage, isOnline: () => false })
    offlineQueue.setScope({ personId: 'p-1', accountId: 'a-1' })
    await offlineQueue.enqueue({ recordKey: 'demo:1', field: 'text', value: 'Typed offline', baseVersion: 2 })
    const reloaded = createSaveQueue({ storage, isOnline: () => false })
    reloaded.setScope({ personId: 'p-1', accountId: 'a-1' })
    const again = renderHook(() => useAutosaveField({ recordKey: 'demo:1', field: 'text', initialValue: 'Server text', baseVersion: 2, queue: reloaded }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(again.result.current.value).toBe('Typed offline')
    expect(again.result.current.state).toBe('saved-on-device')
  })
})

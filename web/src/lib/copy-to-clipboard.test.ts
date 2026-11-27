import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './copy-to-clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('copyToClipboard', () => {
  it('returns true when the clipboard write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyToClipboard('x')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('x')
  })

  it('falls back to execCommand when the write is rejected', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    document.execCommand = vi.fn().mockReturnValue(true)
    await expect(copyToClipboard('x')).resolves.toBe(true)
  })

  it('returns false when the clipboard is unavailable and the fallback is blocked', async () => {
    vi.stubGlobal('navigator', {})
    document.execCommand = vi.fn().mockReturnValue(false)
    await expect(copyToClipboard('x')).resolves.toBe(false)
  })

  it('returns false when the fallback throws', async () => {
    vi.stubGlobal('navigator', {})
    document.execCommand = vi.fn(() => { throw new Error('nope') })
    await expect(copyToClipboard('x')).resolves.toBe(false)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createConversionDeadline,
  MAX_SLIDE_PDF_SIZE,
  SlideConversionValidationError,
  validateSlidePdf,
} from './conversion-policy'

describe('slide conversion policy', () => {
  afterEach(() => vi.useRealTimers())

  it('accepts a PDF within the upload limit', () => {
    const file = new File(['%PDF-1.4'], 'lesson.pdf', { type: 'application/pdf' })
    expect(validateSlidePdf(file)).toBe(file)
  })

  it('rejects missing, non-PDF, and oversized uploads with stable codes', () => {
    expect(() => validateSlidePdf(undefined)).toThrowError(
      expect.objectContaining({ code: 'NO_FILE' }),
    )
    expect(() => validateSlidePdf(new File(['image'], 'slide.png', { type: 'image/png' })))
      .toThrowError(expect.objectContaining({ code: 'INVALID_FILE_TYPE' }))

    const oversized = { type: 'application/pdf', size: MAX_SLIDE_PDF_SIZE + 1 } as File
    expect(() => validateSlidePdf(oversized)).toThrowError(SlideConversionValidationError)
    expect(() => validateSlidePdf(oversized)).toThrowError(
      expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    )
  })

  it('fires a deadline once and supports cancellation', async () => {
    vi.useFakeTimers()
    const timedOut = vi.fn()
    createConversionDeadline(timedOut, 100)
    await vi.advanceTimersByTimeAsync(100)
    expect(timedOut).toHaveBeenCalledTimes(1)

    const cancelled = vi.fn()
    const cancel = createConversionDeadline(cancelled, 100)
    cancel()
    await vi.advanceTimersByTimeAsync(100)
    expect(cancelled).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { pdfRenderScale } from './PresentationStage'

describe('PDF rendering scale', () => {
  it('keeps 130% as exactly 1.3× the fixed scroll viewport fit scale', () => {
    const fitToWidth = pdfRenderScale(1200, 800, 1)
    const zoomed = pdfRenderScale(1200, 800, 1.3)

    expect(zoomed / fitToWidth).toBeCloseTo(1.3)
  })

  it('does not use the already-zoomed page width as the next fit baseline', () => {
    const zoomed = pdfRenderScale(1200, 800, 1.3)

    expect(pdfRenderScale(1200, 800, 1.3)).toBe(zoomed)
  })
})

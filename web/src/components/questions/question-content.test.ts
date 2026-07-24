import { describe, expect, it } from 'vitest'
import { shouldRenderPlainText } from './question-content'

describe('QuestionContent', () => {
  it('does not render plain text twice when it is already a text block', () => {
    expect(shouldRenderPlainText('State the formula', [{ type: 'text', text: 'State the formula' }])).toBe(false)
  })

  it('keeps plain text when content blocks only contain a formula', () => {
    expect(shouldRenderPlainText('Use this formula', [{ type: 'equation', latex: 'v = f \\lambda' }])).toBe(true)
  })
})

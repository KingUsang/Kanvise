import { describe, expect, it } from 'vitest'
import { nextTrapIndex } from './dialog'

describe('nextTrapIndex', () => {
  it('wraps forward from the last item', () => expect(nextTrapIndex(3, 2, false)).toBe(0))
  it('wraps backward from the first item or from outside', () => {
    expect(nextTrapIndex(3, 0, true)).toBe(2)
    expect(nextTrapIndex(3, -1, true)).toBe(2)
  })
  it('lets the browser move within the dialog', () => expect(nextTrapIndex(3, 1, false)).toBeNull())
  it('signals an empty dialog', () => expect(nextTrapIndex(0, -1, false)).toBe(-1))
})

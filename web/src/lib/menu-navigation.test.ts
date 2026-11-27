import { describe, expect, it } from 'vitest'
import { nextMenuIndex } from './menu-navigation'

describe('nextMenuIndex', () => {
  it('wraps with arrow keys', () => {
    expect(nextMenuIndex(2, 1, 'ArrowDown')).toBe(0)
    expect(nextMenuIndex(2, 0, 'ArrowUp')).toBe(1)
    expect(nextMenuIndex(3, -1, 'ArrowDown')).toBe(0)
  })
  it('jumps with Home and End', () => {
    expect(nextMenuIndex(4, 2, 'Home')).toBe(0)
    expect(nextMenuIndex(4, 0, 'End')).toBe(3)
  })
  it('ignores other keys and empty menus', () => {
    expect(nextMenuIndex(2, 0, 'a')).toBeNull()
    expect(nextMenuIndex(0, 0, 'ArrowDown')).toBeNull()
  })
})

/** Next focused index for a menu of `count` items, or null when the key does not move focus. */
export function nextMenuIndex(count: number, current: number, key: string): number | null {
  if (count <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowDown') return current < 0 || current >= count - 1 ? 0 : current + 1
  if (key === 'ArrowUp') return current <= 0 ? count - 1 : current - 1
  return null
}

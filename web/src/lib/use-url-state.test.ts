import { describe, expect, it } from 'vitest'
import { parsePageParam, withSearchParams } from './use-url-state'

describe('url state helpers', () => {
  it('sets and clears params, keeping unrelated ones', () => {
    expect(withSearchParams('student=1', { q: 'ada', page: 2 })).toBe('student=1&q=ada&page=2')
    expect(withSearchParams('q=ada&page=2', { q: '', page: null })).toBe('')
  })
  it('drops values equal to their default', () => {
    expect(withSearchParams('page=3', { page: 1 }, { page: '1' })).toBe('')
  })
  it('parses page numbers defensively', () => {
    expect(parsePageParam('3')).toBe(3)
    expect(parsePageParam('0')).toBe(1)
    expect(parsePageParam('abc')).toBe(1)
    expect(parsePageParam(null)).toBe(1)
  })
})

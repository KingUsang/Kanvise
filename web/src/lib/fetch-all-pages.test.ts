import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from './fetch-all-pages'

const page = (data: number[], hasMore: boolean, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { data, pagination: { has_more: hasMore } } : { error: 'nope' }), { status })

describe('fetchAllPages', () => {
  it('follows has_more until the last page', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page([1, 2], true))
      .mockResolvedValueOnce(page([3], false))
    expect(await fetchAllPages<number>(fetchPage, 'failed')).toEqual([1, 2, 3])
    expect(fetchPage.mock.calls.map(([n]) => n)).toEqual([1, 2])
  })

  it('throws the API error message on a failed page', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([], false, 500))
    await expect(fetchAllPages<number>(fetchPage, 'failed')).rejects.toThrow('nope')
  })
})

import { describe, expect, it } from 'vitest'
import { ApiRequestError, parseApiResponse } from './api-request'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('parseApiResponse', () => {
  it('returns parsed JSON on success', async () => {
    await expect(parseApiResponse(json({ data: [1] }), 'x')).resolves.toEqual({ data: [1] })
  })

  it('throws a typed error with envelope fields for 4xx', async () => {
    const error = await parseApiResponse(json({ error: 'Bad input', code: 'VALIDATION', details: { field: 'a' }, request_id: 'r1' }, 400), 'fallback').then(() => new Error('did not throw'), (e: Error) => e)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION', requestId: 'r1', message: 'Bad input', details: { field: 'a' } })
  })

  it('hides server text for 5xx and unparseable bodies', async () => {
    const e5: Error = await parseApiResponse(json({ error: 'db exploded' }, 500), 'fallback').then(() => new Error('did not throw'), (e: Error) => e)
    expect(e5.message).toBe('fallback')
    const bad = await parseApiResponse(new Response('<html>', { status: 200 }), 'fallback').then(() => new Error('did not throw'), (e: Error) => e)
    expect(bad).toMatchObject({ status: 200, message: 'fallback' })
  })

  it('maps 401 to the session-ended message', async () => {
    const error: Error = await parseApiResponse(json({ error: 'nope' }, 401), 'fallback').then(() => new Error('did not throw'), (e: Error) => e)
    expect(error.message).toMatch(/session has ended/)
  })
})

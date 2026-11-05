import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  ApiError,
  ApiContractEnv,
  REQUEST_ID_HEADER,
  boundedObjectSchema,
  boundedStringSchema,
  mapApiError,
  notFoundHandler,
  parseOffsetPagination,
  requestIdMiddleware,
  strictBooleanQuerySchema,
  uuidSchema,
} from './api-contract'

const requestSchema = z.object({ name: boundedStringSchema }).strict()

function createHarness() {
  let useCaseCalls = 0
  const app = new Hono<ApiContractEnv>()
  app.use('*', requestIdMiddleware)
  app.onError(mapApiError)
  app.notFound(notFoundHandler)
  app.post('/representative', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw new ApiError(400, 'MALFORMED_JSON', 'The request body must be valid JSON.')
    }

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'The request is invalid.', { field: 'name' })
    }

    useCaseCalls += 1
    if (parsed.data.name === 'known') {
      throw new ApiError(409, 'KNOWN_FAILURE', 'The requested operation could not be completed.', {
        field: 'name',
        hint: 'x'.repeat(1_000),
        secret: { raw: 'must not escape' },
      })
    }
    if (parsed.data.name === 'unknown') throw new Error('database password must not escape')

    return c.json({ data: { accepted: true } })
  })

  return { app, getUseCaseCalls: () => useCaseCalls }
}

describe('API contract foundation', () => {
  it('accepts a safe request ID and propagates it in the response header', async () => {
    const { app } = createHarness()
    const response = await app.request('/representative', {
      method: 'POST',
      headers: { [REQUEST_ID_HEADER]: 'client-request-123' },
      body: JSON.stringify({ name: 'ok' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('client-request-123')
    await expect(response.json()).resolves.toEqual({ data: { accepted: true } })
  })

  it('generates a request ID when the header is absent', async () => {
    const { app } = createHarness()
    const response = await app.request('/representative', {
      method: 'POST',
      body: JSON.stringify({ name: 'ok' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('rejects overlong request IDs with a safe error envelope and generated correlation ID', async () => {
    const { app } = createHarness()
    const response = await app.request('/representative', {
      method: 'POST',
      headers: { [REQUEST_ID_HEADER]: 'x'.repeat(129) },
      body: JSON.stringify({ name: 'ok' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ error: 'The request ID is invalid.', code: 'INVALID_REQUEST_ID' })
    expect(body.request_id).toBe(response.headers.get(REQUEST_ID_HEADER))
    expect(body.request_id).not.toBe('x'.repeat(129))
  })

  it('rejects malformed input before the use case and keeps the compatibility envelope', async () => {
    const { app, getUseCaseCalls } = createHarness()
    const response = await app.request('/representative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ error: 'The request is invalid.', code: 'VALIDATION_ERROR' })
    expect(body.details).toEqual({ field: 'name' })
    expect(body.request_id).toBeTruthy()
    expect(getUseCaseCalls()).toBe(0)
  })

  it('maps known errors with bounded details and stable codes', async () => {
    const { app } = createHarness()
    const response = await app.request('/representative', {
      method: 'POST',
      body: JSON.stringify({ name: 'known' }),
    })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      error: 'The requested operation could not be completed.',
      code: 'KNOWN_FAILURE',
    })
    expect(body.details.field).toBe('name')
    expect(body.details.hint).toHaveLength(256)
    expect(body.details.secret).toBeUndefined()
    expect(body.request_id).toBeTruthy()
  })

  it('hides unknown error messages behind INTERNAL_ERROR', async () => {
    const { app } = createHarness()
    const response = await app.request('/representative', {
      method: 'POST',
      body: JSON.stringify({ name: 'unknown' }),
    })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({ error: 'Something went wrong.', code: 'INTERNAL_ERROR' })
    expect(JSON.stringify(body)).not.toContain('database password')
    expect(body.request_id).toBeTruthy()
  })

  it('maps malformed JSON and unknown routes consistently', async () => {
    const { app } = createHarness()
    const malformed = await app.request('/representative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    const missing = await app.request('/missing')

    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toMatchObject({ code: 'MALFORMED_JSON' })
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({ error: 'Not found.', code: 'NOT_FOUND' })
  })

  it('exposes bounded UUID, string, and object primitives', () => {
    expect(uuidSchema.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true)
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
    expect(boundedStringSchema.safeParse('x'.repeat(257)).success).toBe(false)
    expect(boundedObjectSchema.safeParse({ field: 'value' }).success).toBe(true)
    expect(boundedObjectSchema.safeParse(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`field-${i}`, true]))).success).toBe(false)
  })

  it('bounds offset pagination arithmetic and strict query booleans', () => {
    expect(parseOffsetPagination(undefined, undefined)).toEqual({ page: 1, pageSize: 20, offset: 0 })
    expect(parseOffsetPagination('3', '10')).toEqual({ page: 3, pageSize: 10, offset: 20 })
    expect(parseOffsetPagination('9007199254740991', '2')).toBeNull()
    expect(parseOffsetPagination('90071992547410', '100')).toBeNull()
    expect(strictBooleanQuerySchema.safeParse('true').success).toBe(true)
    expect(strictBooleanQuerySchema.safeParse('false').success).toBe(true)
    expect(strictBooleanQuerySchema.safeParse('1').success).toBe(false)
  })
})

import { randomUUID } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'

export const REQUEST_ID_HEADER = 'X-Request-Id'
const MAX_REQUEST_ID_LENGTH = 128
const MAX_DETAIL_KEYS = 8
const MAX_DETAIL_STRING_LENGTH = 256

export type ApiContractEnv = {
  Variables: {
    requestId: string
  }
}

export const uuidSchema = z.string().uuid()
export const boundedStringSchema = z.string().trim().min(1).max(256)
const boundedDetailValueSchema = z.union([
  z.string().max(MAX_DETAIL_STRING_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
])
export const boundedObjectSchema = z
  .record(z.string().min(1).max(64), boundedDetailValueSchema)
  .refine((value) => Object.keys(value).length <= MAX_DETAIL_KEYS, {
    message: `Object must contain at most ${MAX_DETAIL_KEYS} fields`,
  })

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function generateRequestId() {
  return randomUUID()
}

function isSafeRequestId(value: string) {
  return value.length > 0
    && value.length <= MAX_REQUEST_ID_LENGTH
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
}

function resolveRequestId(inbound: string | undefined) {
  if (inbound === undefined) return { value: generateRequestId(), valid: true }
  if (isSafeRequestId(inbound)) return { value: inbound, valid: true }
  return { value: generateRequestId(), valid: false }
}

export const requestIdMiddleware: MiddlewareHandler<ApiContractEnv> = async (c, next) => {
  const resolved = resolveRequestId(c.req.header(REQUEST_ID_HEADER))
  c.set('requestId', resolved.value)
  c.header(REQUEST_ID_HEADER, resolved.value)

  if (!resolved.valid) {
    throw new ApiError(400, 'INVALID_REQUEST_ID', 'The request ID is invalid.')
  }

  await next()
  c.header(REQUEST_ID_HEADER, resolved.value)
}

function safeDetails(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined

  const output: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(details).slice(0, MAX_DETAIL_KEYS)) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) continue
    if (typeof value === 'string') output[key] = value.slice(0, MAX_DETAIL_STRING_LENGTH)
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value
    else if (typeof value === 'boolean' || value === null) output[key] = value
  }

  return Object.keys(output).length ? output : undefined
}

function statusCodeFor(status: number) {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMITED'
  return 'HTTP_ERROR'
}

function safeStatus(status: number): ContentfulStatusCode {
  return (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode
}

function requestIdFrom(c: Context) {
  const requestId = c.get('requestId')
  if (requestId) return requestId
  const generated = generateRequestId()
  c.set('requestId', generated)
  c.header(REQUEST_ID_HEADER, generated)
  return generated
}

export function mapApiError(error: Error, c: Context) {
  const requestId = requestIdFrom(c)
  let status = 500
  let code = 'INTERNAL_ERROR'
  let message = 'Something went wrong.'
  let details: Record<string, string | number | boolean | null> | undefined

  if (error instanceof ApiError) {
    status = error.status
    code = error.code
    message = error.message
    details = safeDetails(error.details)
  } else if (error instanceof HTTPException) {
    status = error.getResponse().status
    code = statusCodeFor(status)
    message = status >= 500 ? 'Something went wrong.' : 'The request could not be completed.'
  } else {
    console.error('api.unhandled_error', { request_id: requestId, error_name: error?.name || 'UnknownError' })
  }

  const body: { error: string; code: string; details?: Record<string, string | number | boolean | null>; request_id: string } = {
    error: message,
    code,
    request_id: requestId,
  }
  if (details) body.details = details
  return c.json(body, safeStatus(status))
}

export function notFoundHandler(c: Context) {
  const requestId = requestIdFrom(c)
  return c.json({
    error: 'Not found.',
    code: 'NOT_FOUND',
    request_id: requestId,
  }, 404)
}

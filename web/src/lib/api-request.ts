import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { SESSION_ENDED_MESSAGE } from '@/lib/safe-api-error'

/** Typed failure from the shared API client. `message` is always safe to show. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | null
  readonly details: unknown
  readonly requestId: string | null

  constructor(status: number, message: string, options: { code?: string | null; details?: unknown; requestId?: string | null } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = options.code ?? null
    this.details = options.details
    this.requestId = options.requestId ?? null
  }
}

/** Parse a response into JSON or throw an `ApiRequestError` built from the
 * API error envelope (`error`, `code`, `details`, `request_id`). The server
 * message is only used for 4xx responses; 5xx and unparseable bodies use the
 * supplied fallback so internals never reach the UI. */
export async function parseApiResponse<T = unknown>(response: Response, fallback: string): Promise<T> {
  const body = await response.clone().json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    const serverMessage = typeof body?.error === 'string' ? body.error : null
    const message = response.status === 401
      ? SESSION_ENDED_MESSAGE
      : serverMessage && response.status < 500 ? serverMessage : fallback
    throw new ApiRequestError(response.status, message, {
      code: typeof body?.code === 'string' ? body.code : null,
      details: body?.details,
      requestId: typeof body?.request_id === 'string' ? body.request_id : response.headers.get('X-Request-Id'),
    })
  }
  if (body === null) throw new ApiRequestError(response.status, fallback)
  return body as T
}

/** Typed JSON request through the shared token-refreshing client. */
export async function apiRequest<T = unknown>(input: RequestInfo | URL, fallback: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await authenticatedApiFetch(input, init)
  } catch {
    throw new ApiRequestError(0, fallback)
  }
  return parseApiResponse<T>(response, fallback)
}

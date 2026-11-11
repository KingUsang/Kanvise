export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.'

export function responseErrorMessage(response: Response, fallback: string) {
  return response.status === 401 ? SESSION_ENDED_MESSAGE : fallback
}

export function safeApiErrorMessage(error: unknown, fallback: string, allowedMessages: readonly string[] = []) {
  if (!(error instanceof Error)) return fallback
  if (error.message === SESSION_ENDED_MESSAGE || allowedMessages.includes(error.message)) return error.message
  return fallback
}

export async function readApiBody<T = unknown>(response: Response): Promise<T | null> {
  return response.clone().json().catch(() => null) as Promise<T | null>
}

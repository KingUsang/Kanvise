import { ACCOUNT_SELECTION_REQUIRED } from './account-cookie'

/**
 * Error thrown by server-side API helpers so pages can react to the API code.
 * Kept free of next/headers so modules imported by client code can use it.
 */
export class ServerApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'ServerApiError'
  }
}

export function isAccountSelectionRequired(error: unknown) {
  return error instanceof ServerApiError && error.code === ACCOUNT_SELECTION_REQUIRED
}

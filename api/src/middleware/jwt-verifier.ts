import { decode, verifyWithJwks } from 'hono/jwt'

type JsonWebKeyWithMetadata = JsonWebKey & {
  kid?: string
  alg?: string
}

type FetchLike = typeof fetch

export const APPROVED_JWT_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
] as const

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_FETCH_TIMEOUT_MS = 2 * 1000
const SUPABASE_JWT_AUDIENCE = 'authenticated'

type Clock = () => number

export class JwtVerificationError extends Error {
  constructor(message = 'JWT verification failed') {
    super(message)
    this.name = 'JwtVerificationError'
  }
}

type VerifierOptions = {
  supabaseUrl: string
  fetchImpl?: FetchLike
  now?: Clock
  cacheTtlMs?: number
  fetchTimeoutMs?: number
}

type CachedJwks = {
  keys: JsonWebKeyWithMetadata[]
  expiresAt: number
}

const SAFE_JWT_ERROR_NAMES = new Set([
  'JwtAlgorithmMismatch',
  'JwtAlgorithmNotAllowed',
  'JwtHeaderInvalid',
  'JwtHeaderRequiresKid',
  'JwtPayloadRequiresAud',
  'JwtSymmetricAlgorithmNotAllowed',
  'JwtTokenAudience',
  'JwtTokenExpired',
  'JwtTokenInvalid',
  'JwtTokenIssuer',
  'JwtTokenIssuedAt',
  'JwtTokenNotBefore',
  'JwtTokenSignatureMismatched',
])

function safeJwtError(error: unknown): Error {
  const safeError = new JwtVerificationError()
  if (error instanceof Error && SAFE_JWT_ERROR_NAMES.has(error.name)) {
    safeError.name = error.name
  }
  return safeError
}

function normalizeSupabaseUrl(supabaseUrl: string) {
  return supabaseUrl.replace(/\/$/, '')
}

function isRequiredExpiry(exp: unknown, now: number) {
  return typeof exp === 'number' && Number.isFinite(exp) && exp > now / 1000
}

export function createJwtVerifier({
  supabaseUrl,
  fetchImpl = fetch,
  now = Date.now,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
}: VerifierOptions) {
  const jwksUrl = `${normalizeSupabaseUrl(supabaseUrl)}/auth/v1/.well-known/jwks.json`
  const issuer = `${normalizeSupabaseUrl(supabaseUrl)}/auth/v1`
  let cache: CachedJwks | null = null
  let inFlightFetch: Promise<JsonWebKeyWithMetadata[]> | null = null

  const fetchJwks = async (forceRefresh = false): Promise<JsonWebKeyWithMetadata[]> => {
    const currentTime = now()
    if (!forceRefresh && cache && cache.expiresAt > currentTime) return cache.keys
    if (inFlightFetch) return inFlightFetch

    inFlightFetch = (async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs)

      try {
        const response = await fetchImpl(jwksUrl, { signal: controller.signal })
        if (!response.ok) throw new JwtVerificationError()
        const body = await response.json() as { keys?: unknown }
        if (!Array.isArray(body.keys)) throw new JwtVerificationError()

        const keys = body.keys as JsonWebKeyWithMetadata[]
        cache = { keys, expiresAt: now() + cacheTtlMs }
        return keys
      } catch (error) {
        if (error instanceof JwtVerificationError) throw error
        throw new JwtVerificationError()
      } finally {
        clearTimeout(timeout)
        inFlightFetch = null
      }
    })()

    return inFlightFetch
  }

  return async function verifyJwt(token: string) {
    let header: { alg?: string; kid?: string }
    try {
      ({ header } = decode(token))
    } catch (error) {
      throw safeJwtError(error)
    }

    if (!header.kid || !APPROVED_JWT_ALGORITHMS.includes(header.alg as typeof APPROVED_JWT_ALGORITHMS[number])) {
      throw new JwtVerificationError()
    }

    let payload: Record<string, unknown>
    try {
      payload = (decode(token).payload || {}) as Record<string, unknown>
    } catch (error) {
      throw safeJwtError(error)
    }
    if (!isRequiredExpiry(payload.exp, now())) throw new JwtVerificationError()

    const verifyWithKeys = async (keys: JsonWebKeyWithMetadata[]) => {
      try {
        return await verifyWithJwks(token, {
          keys,
          allowedAlgorithms: APPROVED_JWT_ALGORITHMS,
          verification: {
            iss: issuer,
            aud: SUPABASE_JWT_AUDIENCE,
            exp: true,
          },
        })
      } catch (error) {
        throw safeJwtError(error)
      }
    }

    let keys = await fetchJwks()
    if (!keys.some((key) => key.kid === header.kid)) {
      keys = await fetchJwks(true)
      if (!keys.some((key) => key.kid === header.kid)) throw new JwtVerificationError()
    }

    return await verifyWithKeys(keys)
  }
}

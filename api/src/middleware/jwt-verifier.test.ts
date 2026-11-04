import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APPROVED_JWT_ALGORITHMS, createJwtVerifier } from './jwt-verifier'

const jwtMocks = vi.hoisted(() => ({
  decode: vi.fn(),
  verifyWithJwks: vi.fn(),
}))

vi.mock('hono/jwt', () => jwtMocks)

const key = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', kid: 'key-1', alg: 'ES256' }
const supabaseUrl = 'https://project.supabase.co'
const token = 'header.payload.signature'

function configureToken(options: { alg?: string; kid?: string; exp?: number } = {}) {
  jwtMocks.decode.mockReturnValue({
    header: { alg: options.alg || 'ES256', kid: options.kid || 'key-1' },
    payload: {
      exp: Object.prototype.hasOwnProperty.call(options, 'exp') ? options.exp : 2_000,
      iss: `${supabaseUrl}/auth/v1`,
      aud: 'authenticated',
    },
  })
}

function jwksResponse(keys: unknown[] = [key]) {
  return new Response(JSON.stringify({ keys }), { status: 200 })
}

describe('createJwtVerifier', () => {
  let nowMs: number

  beforeEach(() => {
    nowMs = 1_000_000
    jwtMocks.decode.mockReset()
    jwtMocks.verifyWithJwks.mockReset()
    jwtMocks.verifyWithJwks.mockResolvedValue({ sub: 'auth-user-1' })
  })

  it('accepts valid claims and passes the approved verification contract', async () => {
    configureToken()
    const fetchImpl = vi.fn(async () => jwksResponse())
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs })

    await expect(verifyJwt(token)).resolves.toEqual({ sub: 'auth-user-1' })
    expect(jwtMocks.verifyWithJwks).toHaveBeenCalledWith(token, expect.objectContaining({
      allowedAlgorithms: APPROVED_JWT_ALGORITHMS,
      verification: {
        iss: `${supabaseUrl}/auth/v1`,
        aud: 'authenticated',
        exp: true,
      },
    }))
  })

  it.each([
    ['wrong issuer', 'JwtTokenIssuer'],
    ['wrong audience', 'JwtTokenAudience'],
  ])('rejects %s without retaining token details', async (_label, errorName) => {
    configureToken()
    jwtMocks.verifyWithJwks.mockRejectedValueOnce(Object.assign(new Error('token-secret'), { name: errorName }))
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl: async () => jwksResponse(), now: () => nowMs })
    const verification = verifyJwt(token)

    await expect(verification).rejects.toMatchObject({ name: errorName })
    await expect(verification).rejects.not.toThrow(token)
  })

  it('rejects expired or missing expiry claims before verification', async () => {
    configureToken({ exp: 999 })
    const fetchImpl = vi.fn(async () => jwksResponse())
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs })

    await expect(verifyJwt(token)).rejects.toMatchObject({ name: 'JwtVerificationError' })
    expect(fetchImpl).not.toHaveBeenCalled()

    configureToken({ exp: undefined })
    await expect(verifyJwt(token)).rejects.toMatchObject({ name: 'JwtVerificationError' })
  })

  it('rejects unsupported algorithms before fetching provider keys', async () => {
    configureToken({ alg: 'HS256' })
    const fetchImpl = vi.fn(async () => jwksResponse())
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs })

    await expect(verifyJwt(token)).rejects.toMatchObject({ name: 'JwtVerificationError' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reuses keys within the bounded cache lifetime and refetches after expiry', async () => {
    configureToken()
    const fetchImpl = vi.fn(async () => jwksResponse())
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs, cacheTtlMs: 100 })

    await verifyJwt(token)
    await verifyJwt(token)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    nowMs += 101
    await verifyJwt(token)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('refreshes once when a token presents an unknown key id', async () => {
    configureToken({ kid: 'key-2' })
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jwksResponse([key]))
      .mockResolvedValueOnce(jwksResponse([{ ...key, kid: 'key-2' }]))
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs })

    await verifyJwt(token)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(jwtMocks.verifyWithJwks).toHaveBeenCalledWith(token, expect.objectContaining({
      keys: [{ ...key, kid: 'key-2' }],
    }))
  })

  it('coalesces concurrent cold-cache requests into one JWKS fetch', async () => {
    configureToken()
    const fetchImpl = vi.fn(async () => {
      await Promise.resolve()
      return jwksResponse()
    })
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs })

    await Promise.all(Array.from({ length: 5 }, () => verifyJwt(token)))

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('bounds fetches and omits provider bodies from failures', async () => {
    configureToken()
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('provider-body-secret')))
    }))
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs, fetchTimeoutMs: 5 })
    const verification = verifyJwt(token)

    await expect(verification).rejects.toMatchObject({ name: 'JwtVerificationError' })
    await expect(verification).rejects.not.toThrow('provider-body-secret')
  })

  it('does not expose a non-success provider response body', async () => {
    configureToken()
    const fetchImpl = vi.fn(async () => new Response('provider-body-secret', { status: 503 }))
    const verifyJwt = createJwtVerifier({ supabaseUrl, fetchImpl, now: () => nowMs })

    await expect(verifyJwt(token)).rejects.not.toThrow('provider-body-secret')
  })
})

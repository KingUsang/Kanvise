import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@aws-sdk/client-ec2', () => ({ EC2Client: class { send = vi.fn() }, StartInstancesCommand: class {}, DescribeInstancesCommand: class {} }))
vi.mock('@aws-sdk/client-ssm', () => ({ SSMClient: class { send = vi.fn() }, SendCommandCommand: class {} }))

// @ts-expect-error plain ESM file deployed separately as a Lambda
import { authenticate, isStaleVersion, resetControllerStateForTests } from '../../../infra/plugnmeet-recorder/recorder-fleet-controller.mjs'
import { signFresh } from './recorder-fleet'

const secret = 's3cret'
const body = JSON.stringify({ action: 'set_capacity', desired_capacity: 1 })
const now = 1_800_000_000

function fresh(ts = now, nonce = 'n1', signedBody = body) {
  return {
    'x-kanvise-recorder-fleet-timestamp': String(ts), 'x-kanvise-recorder-fleet-nonce': nonce,
    'x-kanvise-recorder-fleet-signature-v2': signFresh(signedBody, String(ts), nonce, secret),
  }
}

describe('recorder fleet controller authentication', () => {
  beforeEach(() => resetControllerStateForTests())

  it('accepts a fresh request once and rejects the replay of the same nonce', () => {
    expect(authenticate({ body, headers: fresh(), secret, nowSeconds: now, requireFresh: true })).toMatchObject({ ok: true })
    expect(authenticate({ body, headers: fresh(), secret, nowSeconds: now + 5, requireFresh: true })).toMatchObject({ ok: false, reason: 'replay' })
  })

  it('rejects a stale timestamp even with a valid signature', () => {
    expect(authenticate({ body, headers: fresh(now - 301), secret, nowSeconds: now, requireFresh: true })).toMatchObject({ ok: false, reason: 'stale' })
  })

  it('rejects a body that does not match the signature', () => {
    expect(authenticate({ body: body + ' ', headers: fresh(), secret, nowSeconds: now, requireFresh: false }).ok).toBe(false)
  })

  it('accepts the legacy signature until freshness is required', () => {
    const headers = { 'x-kanvise-recorder-fleet-signature': createHmac('sha256', secret).update(body).digest('hex') }
    expect(authenticate({ body, headers, secret, nowSeconds: now, requireFresh: false })).toMatchObject({ ok: true, fresh: false })
    expect(authenticate({ body, headers, secret, nowSeconds: now, requireFresh: true })).toMatchObject({ ok: false, reason: 'freshness_required' })
  })

  it('rejects a stale command version but allows a resend of the current one', () => {
    expect(isStaleVersion(5)).toBe(false)
    expect(isStaleVersion(5)).toBe(false)
    expect(isStaleVersion(4)).toBe(true)
  })
})

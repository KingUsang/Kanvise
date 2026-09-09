import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  user: { id: 'student-1', role: 'student' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { mockAccessRouter } from './mock-access'

function orderLookup(order: unknown) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: string) => { mocks.eq(column, value); return builder }),
    maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
  }
  mocks.from.mockReturnValue(builder)
}

describe('mock payment return recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'paystack-test-secret')
    orderLookup({ paystack_reference: 'MOCK-REF', status: 'pending', amount_kobo: 500000, offer_id: 'offer-1' })
  })

  it('scopes the order to the signed-in student and rejects a mismatched amount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: { status: 'success', reference: 'MOCK-REF', currency: 'NGN', amount: 499999, id: 42 },
    }), { status: 200 }))

    const response = await mockAccessRouter.request('/mock/orders/MOCK-REF/confirm', { method: 'POST' })

    expect(response.status).toBe(409)
    expect(mocks.eq).toHaveBeenCalledWith('student_id', 'student-1')
    expect(mocks.eq).toHaveBeenCalledWith('paystack_reference', 'MOCK-REF')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('grants the mock only after server-side Paystack verification', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: { status: 'success', reference: 'MOCK-REF', currency: 'NGN', amount: 500000, id: 42 },
    }), { status: 200 }))
    mocks.rpc.mockResolvedValue({ data: { entitlement_id: 'entitlement-1', already_processed: false }, error: null })

    const response = await mockAccessRouter.request('/mock/orders/MOCK-REF/confirm', { method: 'POST' })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('confirm_mock_order_payment', expect.objectContaining({
      p_paystack_reference: 'MOCK-REF', p_paystack_transaction_id: '42', p_amount_kobo: 500000,
    }))
    await expect(response.json()).resolves.toEqual({ data: {
      status: 'paid', offer_id: 'offer-1', entitlement_id: 'entitlement-1', already_confirmed: false,
    } })
  })
})
